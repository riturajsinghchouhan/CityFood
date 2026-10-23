import mongoose from 'mongoose';
import { z } from 'zod';
import { FoodPartnerInquiry, INQUIRY_STATUSES, INQUIRY_TYPES, VEHICLE_TYPES } from '../models/partnerInquiry.model.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';

const text = (label, max = 120) => z.string({ required_error: `${label} is required` }).trim().min(2, `Enter your ${label.toLowerCase()}`).max(max);

const submitSchema = z.object({
    type: z.enum(INQUIRY_TYPES, { errorMap: () => ({ message: 'Invalid inquiry type' }) }),
    fullName: text('Full name', 80),
    phone: z.string({ required_error: 'Mobile number is required' }).trim()
        .transform((v) => v.replace(/\D/g, '').slice(-10))
        .refine((v) => /^[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit mobile number'),
    city: text('City', 80),
    restaurantName: z.string().trim().max(120).optional().default(''),
    vehicleType: z.string().trim().optional().default('')
}).superRefine((dto, ctx) => {
    // Franchise and restaurant forms ask for the restaurant, the delivery form for the vehicle.
    if (dto.type === 'delivery') {
        if (!VEHICLE_TYPES.includes(dto.vehicleType)) ctx.addIssue({ code: 'custom', message: 'Select your vehicle type' });
    } else if (dto.restaurantName.length < 2) {
        ctx.addIssue({ code: 'custom', message: 'Enter the restaurant name' });
    }
}).transform((dto) => (dto.type === 'delivery' ? { ...dto, restaurantName: '' } : { ...dto, vehicleType: '' }));

const updateSchema = z.object({
    status: z.enum(INQUIRY_STATUSES).optional(),
    adminNote: z.string().trim().max(1000).optional()
});

const parse = (schema, body) => {
    const result = schema.safeParse(body || {});
    if (!result.success) throw new ValidationError(result.error.issues[0]?.message || 'Invalid details');
    return result.data;
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Saves a landing page form. The same number sending the same form again within 10 minutes is not saved twice. */
export async function submitInquiry(body) {
    const dto = parse(submitSchema, body);
    const recent = await FoodPartnerInquiry.findOne({
        type: dto.type,
        phone: dto.phone,
        createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) }
    }).lean();
    if (recent) return recent;
    const created = (await FoodPartnerInquiry.create(dto)).toObject();

    // Notify admin panel in real-time
    try {
        const { getIO } = await import('../../../../config/socket.js');
        const io = getIO();
        io.to('admin').emit('admin_notification', {
            type: 'inquiry',
            category: 'partner_inquiry',
            title: `New ${created.type ? created.type.charAt(0).toUpperCase() + created.type.slice(1) : 'Partner'} Inquiry`,
            message: `${created.fullName || 'Lead'} sent an inquiry for ${created.type || 'partnership'}. City: ${created.city || 'N/A'}. Contact: ${created.phone || 'N/A'}.`,
            data: created,
            path: `/admin/food/inquiries/${created.type || 'restaurant'}`,
            createdAt: new Date()
        });
        io.to('admin').emit('sidebar_badges_update');
    } catch (socketErr) {
        console.error('Failed to emit inquiry socket event to admin:', socketErr);
    }

    return created;
}

export async function listInquiries(query = {}) {
    const filter = {};
    if (INQUIRY_TYPES.includes(query.type)) filter.type = query.type;
    if (INQUIRY_STATUSES.includes(query.status)) filter.status = query.status;
    const search = String(query.search || '').trim();
    if (search) {
        const re = new RegExp(escapeRegex(search), 'i');
        filter.$or = [{ fullName: re }, { phone: re }, { city: re }, { restaurantName: re }];
    }
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    const page = Math.max(1, parseInt(query.page, 10) || 1);

    const countFilter = INQUIRY_TYPES.includes(query.type) ? { type: query.type } : {};
    const [inquiries, total, statusRows] = await Promise.all([
        FoodPartnerInquiry.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        FoodPartnerInquiry.countDocuments(filter),
        FoodPartnerInquiry.aggregate([{ $match: countFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }])
    ]);
    const counts = Object.fromEntries(INQUIRY_STATUSES.map((s) => [s, 0]));
    for (const row of statusRows) counts[row._id] = row.count;
    return { inquiries, total, page, limit, counts };
}

export async function updateInquiry(id, body) {
    if (!mongoose.Types.ObjectId.isValid(String(id))) throw new ValidationError('Invalid inquiry id');
    const dto = parse(updateSchema, body);
    const set = { ...dto };
    if (dto.status === 'contacted') set.contactedAt = new Date();
    const updated = await FoodPartnerInquiry.findByIdAndUpdate(id, { $set: set }, { new: true }).lean();
    if (!updated) throw new NotFoundError('Inquiry not found');
    return updated;
}

export async function deleteInquiry(id) {
    if (!mongoose.Types.ObjectId.isValid(String(id))) throw new ValidationError('Invalid inquiry id');
    const deleted = await FoodPartnerInquiry.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundError('Inquiry not found');
    return { deleted: true };
}
