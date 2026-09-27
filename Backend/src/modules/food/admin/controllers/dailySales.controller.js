import { getDailySalesData } from '../services/dailySales.service.js';

export async function getDailySalesController(req, res) {
  try {
    const targetDate = req.query.date;
    const result = await getDailySalesData(targetDate);
    return res.status(200).json({
      success: true,
      message: 'Daily sales data retrieved successfully',
      data: result
    });
  } catch (error) {
    console.error('Error fetching daily sales:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch daily sales data'
    });
  }
}
