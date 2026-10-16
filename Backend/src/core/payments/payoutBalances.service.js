import mongoose from 'mongoose';
import { FoodOrder } from '../../modules/food/orders/models/order.model.js';
import { FoodTransaction } from '../../modules/food/orders/models/foodTransaction.model.js';
import { FoodRestaurantWithdrawal } from '../../modules/food/restaurant/models/foodRestaurantWithdrawal.model.js';
import { FoodDeliveryWithdrawal } from '../../modules/food/delivery/models/foodDeliveryWithdrawal.model.js';
import { FoodDeliveryCashDeposit } from '../../modules/food/delivery/models/foodDeliveryCashDeposit.model.js';
import { DeliveryBonusTransaction } from '../../modules/food/admin/models/deliveryBonusTransaction.model.js';
import { FoodRestaurantAdjustment } from '../../modules/food/restaurant/models/foodRestaurantAdjustment.model.js';
import { addMoney, subMoney, round2 } from '../../utils/money.js';

/**
 * PAYOUT BALANCES — the ONE place restaurant and rider balances are calculated.
 *
 * There is deliberately no stored balance for restaurants or riders (nothing that can drift):
 *   restaurant available = delivered captured earnings   - withdrawals not rejected
 *   rider      pocket    = delivered earnings + bonuses  - approved withdrawals
 *   rider      cash held = cash orders delivered         - cash deposited
 * Every screen and every payout check calls these functions, so they can never disagree.
 */

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const pick = (rows, field = 'total') => Number(rows?.[0]?.[field]) || 0;

/** Restaurant: earned from delivered orders, paid out / requested, and what is left. */
export async function getRestaurantBalances(restaurantId) {
    const rid = oid(restaurantId);

    const [earnedRows, withdrawalRows, adjustmentRows] = await Promise.all([
        FoodTransaction.aggregate([
            {
                $match: {
                    restaurantId: rid,
                    status: { $in: ['captured', 'authorized'] },
                    'settlement.isRestaurantSettled': { $ne: true },
                    // money the customer is disputing is held back until the dispute ends
                    'dispute.status': { $nin: ['open', 'under_review'] }
                }
            },
            { $lookup: { from: FoodOrder.collection.name, localField: 'orderId', foreignField: '_id', as: 'order' } },
            { $match: { 'order.orderStatus': 'delivered' } },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$amounts.restaurantShare', 0] } } } }
        ]),
        // Pending and approved both reduce what can be withdrawn; rejected does not
        FoodRestaurantWithdrawal.aggregate([
            { $match: { restaurantId: rid, status: { $in: ['pending', 'approved'] } } },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ['$amount', 0] } },
                    pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } }
                }
            }
        ]),
        // Manual admin adjustments (signed amounts: credits positive, debits negative)
        FoodRestaurantAdjustment.aggregate([
            { $match: { restaurantId: rid } },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } }
        ])
    ]);

    const earned = round2(pick(earnedRows));
    const withdrawn = round2(pick(withdrawalRows));
    const adjustments = round2(pick(adjustmentRows));
    return {
        earned,
        withdrawn,
        pendingWithdrawals: round2(pick(withdrawalRows, 'pending')),
        adjustments,
        available: Math.max(0, addMoney(subMoney(earned, withdrawn), adjustments))
    };
}

/** Rider: earnings, bonuses, withdrawals and cash held — one consistent set of numbers. */
export async function getRiderBalances(partnerId) {
    const pid = oid(partnerId);

    const [earnedRows, bonusRows, withdrawalRows, cashRows, depositRows] = await Promise.all([
        FoodOrder.aggregate([
            { $match: { 'dispatch.deliveryPartnerId': pid, orderStatus: 'delivered' } },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$riderEarning', 0] } } } }
        ]),
        DeliveryBonusTransaction.aggregate([
            { $match: { deliveryPartnerId: pid } },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } }
        ]),
        FoodDeliveryWithdrawal.aggregate([
            { $match: { deliveryPartnerId: pid, status: { $in: ['pending', 'approved'] } } },
            {
                $group: {
                    _id: null,
                    approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$amount', 0] } },
                    pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } }
                }
            }
        ]),
        FoodOrder.aggregate([
            { $match: { 'dispatch.deliveryPartnerId': pid, orderStatus: 'delivered', 'payment.method': 'cash' } },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$pricing.total', 0] } } } }
        ]),
        FoodDeliveryCashDeposit.aggregate([
            { $match: { deliveryPartnerId: pid, status: 'Completed' } },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } }
        ])
    ]);

    const totalEarned = round2(pick(earnedRows));
    const totalBonus = round2(pick(bonusRows));
    const approvedWithdrawals = round2(pick(withdrawalRows, 'approved'));
    const pendingWithdrawals = round2(pick(withdrawalRows, 'pending'));
    const cashCollected = round2(pick(cashRows));
    const depositedCash = round2(pick(depositRows));

    const gross = addMoney(totalEarned, totalBonus);
    const cashInHand = Math.max(0, subMoney(cashCollected, depositedCash));
    const pocketBalance = Math.max(0, subMoney(gross, approvedWithdrawals));

    return {
        totalEarned,
        totalBonus,
        totalWithdrawn: approvedWithdrawals,
        pendingWithdrawals,
        cashCollected,
        depositedCash,
        cashInHand,
        /** Earnings + bonuses - approved withdrawals (what the rider app shows) */
        pocketBalance,
        /** What can still be requested right now (pending requests are already spoken for) */
        availableToWithdraw: Math.max(0, subMoney(pocketBalance, pendingWithdrawals)),
        /** Pocket balance net of pending requests and cash the rider still holds (admin wallet list) */
        pocketBalanceNetOfCash: Math.max(
            0,
            subMoney(subMoney(gross, addMoney(approvedWithdrawals, pendingWithdrawals)), cashInHand)
        )
    };
}
