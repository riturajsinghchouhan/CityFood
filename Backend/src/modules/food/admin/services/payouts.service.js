import mongoose from 'mongoose';
import { FoodOrder } from '../../orders/models/order.model.js';
import { FoodTransaction } from '../../orders/models/foodTransaction.model.js';
import { FoodRestaurantWithdrawal } from '../../restaurant/models/foodRestaurantWithdrawal.model.js';
import { FoodRestaurantAdjustment } from '../../restaurant/models/foodRestaurantAdjustment.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { getRestaurantBalances } from '../../../../core/payments/payoutBalances.service.js';
import { withPayoutLock } from '../../../../core/payments/payoutLock.js';
import { sessionOpts } from '../../../../utils/dbTransaction.js';
import { round2, gtMoney } from '../../../../utils/money.js';

/**
 * What the restaurant earns on an order is `amounts.restaurantShare` on its finance record
 * (item + packaging - commission - GST/gateway fees). Admin payout screens and the restaurant's own
 * screen must show the same number, so both read it from there. Orders without a finance record
 * (very old data) fall back to subtotal + packaging - commission.
 */
async function getRestaurantShareMap(orderIds) {
    if (!orderIds.length) return new Map();
    const rows = await FoodTransaction.find({ orderId: { $in: orderIds } }).select('orderId amounts.restaurantShare').lean();
    return new Map(rows.map((r) => [String(r.orderId), Number(r.amounts?.restaurantShare)]));
}

function payoutOf(shareMap, order, subtotal, packagingFee, commission) {
    const share = shareMap.get(String(order._id));
    return Number.isFinite(share) ? share : Math.max(0, (subtotal + packagingFee) - commission);
}

/**
 * Summary card totals for restaurant payouts based on filters.
 * STRICT RULES:
 * 1. Filter by deliveryState.deliveredAt for date filtering
 * 2. Only include orderStatus = 'delivered' for payout math
 * 3. totalPaid = sum of ALL approved withdrawals for that restaurant (unfiltered by date)
 * 4. totalRemaining = totalPayout - totalPaid + totalAdjustments
 * 5. Includes all restaurants (active, approved, banned, inactive).
 */
export async function getPayoutSummary(query = {}) {
    const filter = {
        orderStatus: 'delivered'
    };

    if (query.restaurantId && mongoose.Types.ObjectId.isValid(query.restaurantId)) {
        filter.restaurantId = new mongoose.Types.ObjectId(query.restaurantId);
    }

    if (query.fromDate || query.toDate) {
        filter['deliveryState.deliveredAt'] = {};
        if (query.fromDate) {
            const start = new Date(query.fromDate);
            start.setHours(0, 0, 0, 0);
            filter['deliveryState.deliveredAt'].$gte = start;
        }
        if (query.toDate) {
            const end = new Date(query.toDate);
            end.setHours(23, 59, 59, 999);
            filter['deliveryState.deliveredAt'].$lte = end;
        }
    }

    // Aggregate delivered orders for revenue & payout calculations
    const summaryAgg = await FoodOrder.aggregate([
        { $match: filter },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: { $ifNull: ['$pricing.total', 0] } },
                totalCommission: { $sum: { $ifNull: ['$pricing.restaurantCommission', 0] } },
                totalGst: {
                    $sum: {
                        $add: [
                            { $ifNull: ['$pricing.tax', { $ifNull: ['$pricing.gstAmount', 0] }] },
                            { $ifNull: ['$pricing.additionalChargesGst', 0] }
                        ]
                    }
                },
                totalDeliveryFee: { $sum: { $ifNull: ['$pricing.deliveryFee', 0] } },
                totalPlatformFee: { $sum: { $ifNull: ['$pricing.platformFee', 0] } },
                totalSubtotal: { $sum: { $ifNull: ['$pricing.subtotal', 0] } },
                totalPackagingFee: { $sum: { $ifNull: ['$pricing.packagingFee', 0] } }
            }
        }
    ]);

    const stats = summaryAgg[0] || {};
    const totalRevenue = Math.round((stats.totalRevenue || 0) * 100) / 100;
    const totalCommission = Math.round((stats.totalCommission || 0) * 100) / 100;
    const totalGst = Math.round((stats.totalGst || 0) * 100) / 100;
    const totalDeliveryFee = Math.round((stats.totalDeliveryFee || 0) * 100) / 100;
    const totalPlatformFee = Math.round((stats.totalPlatformFee || 0) * 100) / 100;
    const totalSubtotal = stats.totalSubtotal || 0;
    const totalPackagingFee = stats.totalPackagingFee || 0;

    // Earning Formula: totalPayout = (subtotal + packagingFee) - restaurantCommission
    const payoutAgg = await FoodOrder.aggregate([
        { $match: filter },
        { $lookup: { from: FoodTransaction.collection.name, localField: '_id', foreignField: 'orderId', as: 'tx' } },
        {
            $group: {
                _id: null,
                total: {
                    $sum: {
                        $let: {
                            vars: { t: { $arrayElemAt: ['$tx', 0] } },
                            in: {
                                $cond: [
                                    { $ne: [{ $type: '$t.amounts.restaurantShare' }, 'missing'] },
                                    '$t.amounts.restaurantShare',
                                    {
                                        $max: [0, {
                                            $subtract: [
                                                { $add: [{ $ifNull: ['$pricing.subtotal', 0] }, { $ifNull: ['$pricing.packagingFee', 0] }] },
                                                { $ifNull: ['$pricing.restaurantCommission', 0] }
                                            ]
                                        }]
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        }
    ]);
    const totalPayout = Math.max(0, Math.round((payoutAgg[0]?.total || 0) * 100) / 100);

    // Rule 3: Do NOT filter totalPaid by date!
    // totalPaid = sum of ALL approved withdrawals for that restaurant
    const withdrawalFilter = { status: 'approved' };
    if (query.restaurantId && mongoose.Types.ObjectId.isValid(query.restaurantId)) {
        withdrawalFilter.restaurantId = new mongoose.Types.ObjectId(query.restaurantId);
    }

    const paidAgg = await FoodRestaurantWithdrawal.aggregate([
        { $match: withdrawalFilter },
        {
            $group: {
                _id: null,
                totalPaid: { $sum: { $ifNull: ['$amount', 0] } }
            }
        }
    ]);

    const totalPaid = Math.round((paidAgg[0]?.totalPaid || 0) * 100) / 100;

    const adjFilter = {};
    if (query.restaurantId && mongoose.Types.ObjectId.isValid(query.restaurantId)) {
        adjFilter.restaurantId = new mongoose.Types.ObjectId(query.restaurantId);
    }
    const adjAgg = await FoodRestaurantAdjustment.aggregate([
        { $match: adjFilter },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } }
    ]);
    const totalAdjustments = Math.round((adjAgg[0]?.total || 0) * 100) / 100;

    const totalRemaining = Math.max(0, Math.round((totalPayout - totalPaid + totalAdjustments) * 100) / 100);

    return {
        totalRevenue,
        totalPayout,
        totalCommission,
        totalGst,
        totalDeliveryFee,
        totalPlatformFee,
        totalPaid,
        totalAdjustments,
        totalRemaining
    };
}

/**
 * Returns paginated list of delivered orders for payouts table.
 */
export async function getPayoutOrders(query = {}) {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 500);
    const skip = (page - 1) * limit;

    const filter = {
        orderStatus: 'delivered'
    };

    if (query.restaurantId && mongoose.Types.ObjectId.isValid(query.restaurantId)) {
        filter.restaurantId = new mongoose.Types.ObjectId(query.restaurantId);
    }

    if (query.fromDate || query.toDate) {
        filter['deliveryState.deliveredAt'] = {};
        if (query.fromDate) {
            const start = new Date(query.fromDate);
            start.setHours(0, 0, 0, 0);
            filter['deliveryState.deliveredAt'].$gte = start;
        }
        if (query.toDate) {
            const end = new Date(query.toDate);
            end.setHours(23, 59, 59, 999);
            filter['deliveryState.deliveredAt'].$lte = end;
        }
    }

    const [orders, total] = await Promise.all([
        FoodOrder.find(filter)
            .populate('restaurantId', 'restaurantName isBanned status')
            .sort({ 'deliveryState.deliveredAt': -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        FoodOrder.countDocuments(filter)
    ]);

    const shareMap = await getRestaurantShareMap(orders.map((o) => o._id));
    const data = orders.map((o, idx) => {
        const items = Array.isArray(o.items) ? o.items : [];
        const itemName = items.map(it => it.name).filter(Boolean).join(', ') || 'N/A';
        const subtotal = Number(o.pricing?.subtotal || 0);
        const packagingFee = Number(o.pricing?.packagingFee || 0);
        const commission = Number(o.pricing?.restaurantCommission || 0);
        const gst = Number(o.pricing?.tax || o.pricing?.gstAmount || 0) + Number(o.pricing?.additionalChargesGst || 0);
        const deliveryFee = Number(o.pricing?.deliveryFee || 0);
        const platformFee = Number(o.pricing?.platformFee || 0);
        const payoutAmount = payoutOf(shareMap, o, subtotal, packagingFee, commission);

        const deliveredAt = o.deliveryState?.deliveredAt || o.updatedAt || o.createdAt;

        const isBanned = Boolean(o.restaurantId?.isBanned || o.restaurantId?.status === 'banned');
        const restaurantName = o.restaurantId?.restaurantName
            ? `${o.restaurantId.restaurantName}${isBanned ? ' (Banned)' : ''}`
            : 'N/A';

        return {
            srNo: skip + idx + 1,
            orderId: o.order_id || o.orderId || String(o._id),
            restaurantName,
            isBanned,
            itemName,
            itemAmount: subtotal,
            commission,
            gst,
            deliveryFee,
            platformFee,
            payoutAmount,
            dateTime: deliveredAt
        };
    });

    return {
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1
        }
    };
}

/**
 * Formats JSON payload for PDF generation.
 */
export async function getPayoutPdfData(query = {}) {
    let restaurant = null;
    if (query.restaurantId && mongoose.Types.ObjectId.isValid(query.restaurantId)) {
        restaurant = await FoodRestaurant.findById(query.restaurantId)
            .select('restaurantName ownerName ownerPhone ownerEmail accountNumber ifscCode bankName accountHolderName addressLine1 area city state pincode isBanned status')
            .lean();
    }

    const filter = {
        orderStatus: 'delivered'
    };

    if (query.restaurantId && mongoose.Types.ObjectId.isValid(query.restaurantId)) {
        filter.restaurantId = new mongoose.Types.ObjectId(query.restaurantId);
    }

    if (query.fromDate || query.toDate) {
        filter['deliveryState.deliveredAt'] = {};
        if (query.fromDate) {
            const start = new Date(query.fromDate);
            start.setHours(0, 0, 0, 0);
            filter['deliveryState.deliveredAt'].$gte = start;
        }
        if (query.toDate) {
            const end = new Date(query.toDate);
            end.setHours(23, 59, 59, 999);
            filter['deliveryState.deliveredAt'].$lte = end;
        }
    }

    const orders = await FoodOrder.find(filter)
        .populate('restaurantId', 'restaurantName isBanned status')
        .sort({ 'deliveryState.deliveredAt': -1 })
        .lean();

    const shareMap = await getRestaurantShareMap(orders.map((o) => o._id));
    let totalPayout = 0;
    let totalRevenue = 0;
    let totalCommission = 0;

    const formattedOrders = orders.map((o, idx) => {
        const items = Array.isArray(o.items) ? o.items : [];
        const itemName = items.map(it => it.name).filter(Boolean).join(', ') || 'N/A';
        const subtotal = Number(o.pricing?.subtotal || 0);
        const packagingFee = Number(o.pricing?.packagingFee || 0);
        const commission = Number(o.pricing?.restaurantCommission || 0);
        const total = Number(o.pricing?.total || 0);
        const payoutAmount = payoutOf(shareMap, o, subtotal, packagingFee, commission);

        totalPayout += payoutAmount;
        totalRevenue += total;
        totalCommission += commission;

        const deliveredAt = o.deliveryState?.deliveredAt || o.updatedAt || o.createdAt;

        const isBanned = Boolean(o.restaurantId?.isBanned || o.restaurantId?.status === 'banned');
        const restaurantName = o.restaurantId?.restaurantName
            ? `${o.restaurantId.restaurantName}${isBanned ? ' (Banned)' : ''}`
            : 'N/A';

        return {
            srNo: idx + 1,
            orderId: o.order_id || o.orderId || String(o._id),
            restaurantName,
            isBanned,
            itemName,
            itemAmount: subtotal,
            payoutAmount,
            commission,
            dateTime: deliveredAt
        };
    });

    const isBanned = Boolean(restaurant?.isBanned || restaurant?.status === 'banned');

    return {
        restaurant: restaurant ? {
            name: `${restaurant.restaurantName}${isBanned ? ' (Banned)' : ''}`,
            ownerName: restaurant.ownerName,
            ownerPhone: restaurant.ownerPhone,
            isBanned,
            bankDetails: {
                accountHolderName: restaurant.accountHolderName || '',
                accountNumber: restaurant.accountNumber || '',
                ifscCode: restaurant.ifscCode || ''
            }
        } : null,
        dateRange: {
            fromDate: query.fromDate || null,
            toDate: query.toDate || null
        },
        orders: formattedOrders,
        summary: {
            totalOrders: formattedOrders.length,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            totalCommission: Math.round(totalCommission * 100) / 100,
            totalPayout: Math.round(totalPayout * 100) / 100
        }
    };
}

/**
 * Records an approved payout to a restaurant. The balance check and the record are written
 * under the restaurant's payout lock, so a payout can never exceed what is owed, even next to a
 * simultaneous withdrawal request.
 */
export async function markPayoutAsPaid({ restaurantId, amount, transactionId, adminNote }) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
        throw new ValidationError('Valid restaurant ID is required');
    }
    const numericAmount = round2(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new ValidationError('Amount must be a positive number');
    }

    const restaurant = await FoodRestaurant.findById(restaurantId).lean();
    if (!restaurant) throw new ValidationError('Restaurant not found');

    const withdrawal = await withPayoutLock('restaurant', restaurantId, async (session) => {
        const { available } = await getRestaurantBalances(restaurantId);
        if (gtMoney(numericAmount, available)) {
            throw new ValidationError(`Amount exceeds the restaurant's available balance of ₹${available}`);
        }
        const [created] = await FoodRestaurantWithdrawal.create([{
            restaurantId: new mongoose.Types.ObjectId(restaurantId),
            amount: numericAmount,
            status: 'approved',
            paymentMethod: 'bank_transfer',
            bankDetails: {
                accountNumber: restaurant.accountNumber || '',
                ifscCode: restaurant.ifscCode || '',
                bankName: restaurant.bankName || '',
                accountHolderName: restaurant.accountHolderName || ''
            },
            transactionId: transactionId || `MANUAL-${Date.now()}`,
            adminNote: adminNote || 'Manual payout recorded by admin',
            processedAt: new Date()
        }], sessionOpts(session));
        return created;
    });

    try {
        const { notifyOwnerSafely } = await import('../../../../core/notifications/firebase.service.js');
        await notifyOwnerSafely(
            { ownerType: 'RESTAURANT', ownerId: restaurantId },
            {
                title: 'Payout Settled 💰',
                body: `₹${numericAmount} has been settled to your account by admin.`,
                image: 'https://i.ibb.co/3m2Yh7r/Tuggo-Brand-Image.png',
                data: {
                    type: 'payout_settled',
                    amount: String(numericAmount),
                    transactionId: withdrawal.transactionId
                }
            }
        );
    } catch (e) {
        console.error('Failed to send restaurant payout push notification:', e);
    }

    if (restaurant.ownerEmail) {
        try {
            const { sendSettlementEmail } = await import('../../../../utils/email.js');
            await sendSettlementEmail(restaurant.ownerEmail, {
                recipientName: restaurant.restaurantName || restaurant.ownerName,
                amount: numericAmount,
                type: 'restaurant_payout',
                transactionId: withdrawal.transactionId,
                adminNote: withdrawal.adminNote
            });
        } catch (e) {
            console.error('Failed to send restaurant payout settlement email:', e);
        }
    }

    return withdrawal;
}
