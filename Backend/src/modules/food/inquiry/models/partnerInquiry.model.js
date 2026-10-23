import mongoose from 'mongoose';

export const INQUIRY_TYPES = ['franchise', 'restaurant', 'delivery'];
export const INQUIRY_STATUSES = ['new', 'contacted', 'closed'];
export const VEHICLE_TYPES = ['bike', 'scooter', 'electric', 'bicycle'];

/** A "partner with us" form sent from the public franchise / restaurant / delivery landing pages. */
const partnerInquirySchema = new mongoose.Schema(
    {
        type: { type: String, enum: INQUIRY_TYPES, required: true, index: true },
        fullName: { type: String, required: true, trim: true },
        phone: { type: String, required: true, trim: true },
        city: { type: String, required: true, trim: true },
        /** Franchise and restaurant forms only. */
        restaurantName: { type: String, trim: true, default: '' },
        /** Delivery form only. */
        vehicleType: { type: String, enum: [...VEHICLE_TYPES, ''], default: '' },
        status: { type: String, enum: INQUIRY_STATUSES, default: 'new', index: true },
        /** What the admin noted after calling. */
        adminNote: { type: String, trim: true, default: '' },
        contactedAt: { type: Date, default: null }
    },
    { collection: 'food_partner_inquiries', timestamps: true }
);

partnerInquirySchema.index({ type: 1, createdAt: -1 });

export const FoodPartnerInquiry = mongoose.model('FoodPartnerInquiry', partnerInquirySchema);
