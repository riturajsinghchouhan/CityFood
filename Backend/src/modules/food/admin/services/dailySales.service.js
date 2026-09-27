import mongoose from 'mongoose';
import { FoodOrder } from '../../orders/models/order.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodDeliveryPartner } from '../../delivery/models/deliveryPartner.model.js';
import { FoodUser } from '../../../../core/users/user.model.js';

export async function getDailySalesData(targetDateStr) {
  // Determine date bounds in Asia/Kolkata (UTC+05:30)
  let dateStr = targetDateStr;
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const now = new Date();
    dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
  }

  const startOfDay = new Date(`${dateStr}T00:00:00.000+05:30`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999+05:30`);

  // Query delivered orders matching date bounds
  const deliveredFilter = {
    orderStatus: 'delivered',
    $or: [
      { 'deliveryState.deliveredAt': { $gte: startOfDay, $lte: endOfDay } },
      { deliveredAt: { $gte: startOfDay, $lte: endOfDay } },
      {
        $and: [
          { 'deliveryState.deliveredAt': null },
          { deliveredAt: null },
          { updatedAt: { $gte: startOfDay, $lte: endOfDay } }
        ]
      },
      {
        $and: [
          { 'deliveryState.deliveredAt': null },
          { deliveredAt: null },
          { createdAt: { $gte: startOfDay, $lte: endOfDay } }
        ]
      }
    ]
  };

  const rawOrders = await FoodOrder.find(deliveredFilter)
    .populate('userId', 'name phone email')
    .populate('restaurantId', 'restaurantName name ownerName ownerPhone area city addressLine1')
    .populate('dispatch.deliveryPartnerId', 'name phone vehicleType status availabilityStatus')
    .sort({ 'deliveryState.deliveredAt': -1, updatedAt: -1, createdAt: -1 })
    .lean();

  const foodOrders = [];
  const riderMap = {};
  const restaurantMap = {};

  rawOrders.forEach((order) => {
    const pricing = order.pricing || {};
    const payment = order.payment || {};

    const subtotal = Number(pricing.subtotal || pricing.itemTotal || 0);
    const packagingFee = Number(pricing.packagingFee || 0);
    const handlingFee = Number(pricing.handlingFee || 0);
    const deliveryFee = Number(pricing.deliveryFee || 0);
    const platformFee = Number(pricing.platformFee || 0);
    const tax = Number(pricing.tax || pricing.gstAmount || pricing.gst || pricing.gstOnItem || 0);
    const discount = Number(pricing.discount || 0);

    const computedTotal = Number(
      order.total || pricing.total || order.payableAmount || order.amount || 0
    );
    const totalPaid = computedTotal > 0
      ? computedTotal
      : Math.max(0, subtotal + packagingFee + handlingFee + deliveryFee + platformFee + tax - discount);

    const commission = Number(pricing.restaurantCommission || 0);
    const riderEarning = Number(order.riderEarning || 0);

    // Earnings distribution
    const storeEarned = Math.max(0, subtotal + packagingFee - commission);
    const deliveryMargin = Math.max(0, deliveryFee - riderEarning);
    const adminEarned = Math.max(0, commission + platformFee + tax + deliveryMargin);

    // Payment classification
    const paymentMethodRaw = String(payment.method || '').toLowerCase();
    const isCod = ['cash', 'cod', 'cash_on_delivery'].includes(paymentMethodRaw);
    const isRiderQr = paymentMethodRaw === 'razorpay_qr' || !!payment.qr?.qrId;
    const isOnline = !isCod;

    const deliveryPartner = order.dispatch?.deliveryPartnerId || null;
    const partnerId = deliveryPartner?._id ? String(deliveryPartner._id) : null;

    // Delivery time resolution
    const deliveredAt =
      order.deliveryState?.deliveredAt ||
      order.deliveredAt ||
      order.completedAt ||
      (() => {
        const history = Array.isArray(order.statusHistory) ? [...order.statusHistory].reverse() : [];
        const entry = history.find((e) =>
          ['delivered', 'completed'].includes(String(e?.to || e?.status || '').toLowerCase())
        );
        return entry?.at || null;
      })() ||
      order.updatedAt ||
      order.createdAt;

    const createdAt = order.createdAt || null;
    let deliveryDurationMinutes = null;
    if (createdAt && deliveredAt) {
      const diffMs = new Date(deliveredAt).getTime() - new Date(createdAt).getTime();
      if (diffMs >= 0) {
        deliveryDurationMinutes = Math.round(diffMs / 60000);
      }
    }

    const storeName =
      order.restaurantId?.restaurantName ||
      order.restaurantId?.name ||
      order.restaurantName ||
      'Restaurant';
    const storeId = order.restaurantId?._id ? String(order.restaurantId._id) : null;

    const orderIdStr = order.orderId || order.order_id || String(order._id);

    const itemDetails = {
      id: order._id,
      orderId: orderIdStr,
      orderType: 'food',
      storeId,
      storeName,
      customer: {
        id: order.userId?._id || null,
        name: order.userId?.name || order.customerName || 'Customer',
        phone: order.userId?.phone || order.customerPhone || order.phone || ''
      },
      deliveryPartner: deliveryPartner
        ? {
            id: deliveryPartner._id,
            name: deliveryPartner.name || 'Rider',
            phone: deliveryPartner.phone || '',
            vehicleType: deliveryPartner.vehicleType || 'Bike'
          }
        : null,
      pricing: {
        subtotal,
        packagingFee,
        handlingFee,
        deliveryFee,
        platformFee,
        tax,
        discount,
        totalPaid,
        commission
      },
      shares: {
        storeEarned,
        adminEarned,
        riderEarned: riderEarning
      },
      payment: {
        method: payment.method || 'cash',
        isCod,
        isRiderQr,
        isOnline,
        status: payment.status || 'paid',
        codCollected: isCod ? totalPaid : 0,
        onlinePaid: isOnline ? totalPaid : 0
      },
      itemCount: Array.isArray(order.items) ? order.items.length : (order.itemCount || 1),
      itemsSummary: Array.isArray(order.items)
        ? order.items
            .map((i) => `${i.quantity || 1}x ${i.name || i.foodItem?.name || i.title || 'Item'}`)
            .slice(0, 3)
            .join(', ')
        : '',
      createdAt,
      deliveredAt,
      deliveryDurationMinutes
    };

    foodOrders.push(itemDetails);

    // Aggregate Restaurant
    if (storeId) {
      if (!restaurantMap[storeId]) {
        restaurantMap[storeId] = {
          restaurantId: storeId,
          restaurantName: storeName,
          area: order.restaurantId?.area || '',
          ordersCount: 0,
          grossSales: 0,
          commissionDeducted: 0,
          netPayable: 0
        };
      }
      restaurantMap[storeId].ordersCount += 1;
      restaurantMap[storeId].grossSales += totalPaid;
      restaurantMap[storeId].commissionDeducted += commission;
      restaurantMap[storeId].netPayable += storeEarned;
    }

    // Aggregate Delivery Partner
    if (partnerId) {
      if (!riderMap[partnerId]) {
        riderMap[partnerId] = {
          partnerId,
          name: deliveryPartner.name || 'Rider',
          phone: deliveryPartner.phone || '',
          vehicleType: deliveryPartner.vehicleType || 'Bike',
          foodOrdersCount: 0,
          totalOrdersCount: 0,
          foodEarnings: 0,
          totalEarnings: 0,
          codCashCollected: 0,
          onlinePaymentsHandled: 0,
          qrPaymentsCollected: 0,
          ordersList: []
        };
      }
      const rider = riderMap[partnerId];
      rider.totalOrdersCount += 1;
      rider.totalEarnings += riderEarning;
      rider.foodOrdersCount += 1;
      rider.foodEarnings += riderEarning;

      if (isCod) {
        rider.codCashCollected += totalPaid;
      } else {
        rider.onlinePaymentsHandled += totalPaid;
      }

      if (isRiderQr) {
        rider.qrPaymentsCollected += totalPaid;
      }

      rider.ordersList.push({
        orderId: itemDetails.orderId,
        orderType: 'food',
        storeName: itemDetails.storeName,
        totalPaid,
        riderEarning,
        paymentMethod: itemDetails.payment.method,
        isCod,
        createdAt: itemDetails.createdAt,
        deliveredAt,
        deliveryDurationMinutes: itemDetails.deliveryDurationMinutes
      });
    }
  });

  // Calculate summaries
  const buildSummary = (orders) => {
    const summary = orders.reduce(
      (acc, o) => {
        acc.totalOrders += 1;
        acc.totalCustomerPaid += o.pricing.totalPaid;
        acc.totalSubtotal += o.pricing.subtotal;
        acc.totalDeliveryFee += o.pricing.deliveryFee;
        acc.totalPackagingFee += o.pricing.packagingFee;
        acc.totalHandlingFee += o.pricing.handlingFee;
        acc.totalPlatformFee += o.pricing.platformFee;
        acc.totalTax += o.pricing.tax;
        acc.totalDiscounts += o.pricing.discount;
        acc.totalStoreEarned += o.shares.storeEarned;
        acc.totalAdminEarned += o.shares.adminEarned;
        acc.totalRiderEarned += o.shares.riderEarned;
        if (o.payment.isCod) {
          acc.totalCodCollected += o.pricing.totalPaid;
        } else {
          acc.totalOnlinePaid += o.pricing.totalPaid;
        }
        return acc;
      },
      {
        totalOrders: 0,
        totalCustomerPaid: 0,
        totalSubtotal: 0,
        totalDeliveryFee: 0,
        totalPackagingFee: 0,
        totalHandlingFee: 0,
        totalPlatformFee: 0,
        totalTax: 0,
        totalDiscounts: 0,
        totalStoreEarned: 0,
        totalAdminEarned: 0,
        totalRiderEarned: 0,
        totalCodCollected: 0,
        totalOnlinePaid: 0
      }
    );

    const ordersWithDuration = orders.filter((o) => typeof o.deliveryDurationMinutes === 'number');
    summary.avgDeliveryTimeMinutes =
      ordersWithDuration.length > 0
        ? Math.round(
            ordersWithDuration.reduce((s, o) => s + o.deliveryDurationMinutes, 0) /
              ordersWithDuration.length
          )
        : 0;

    return summary;
  };

  const foodSummary = buildSummary(foodOrders);

  const overallSummary = {
    totalOrders: foodSummary.totalOrders,
    totalCustomerPaid: foodSummary.totalCustomerPaid,
    totalStoreEarned: foodSummary.totalStoreEarned,
    totalAdminEarned: foodSummary.totalAdminEarned,
    totalRiderEarned: foodSummary.totalRiderEarned,
    totalCodCollected: foodSummary.totalCodCollected,
    totalOnlinePaid: foodSummary.totalOnlinePaid,
    avgDeliveryTimeMinutes: foodSummary.avgDeliveryTimeMinutes
  };

  const deliveryBoysSummary = Object.values(riderMap).sort(
    (a, b) => b.totalOrdersCount - a.totalOrdersCount
  );
  const restaurantsSummary = Object.values(restaurantMap).sort(
    (a, b) => b.grossSales - a.grossSales
  );

  return {
    date: dateStr,
    overallSummary,
    foodSummary,
    foodOrders,
    deliveryBoysSummary,
    restaurantsSummary
  };
}
