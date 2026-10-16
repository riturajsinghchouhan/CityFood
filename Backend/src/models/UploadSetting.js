import mongoose from 'mongoose';

// Singleton document (key: 'singleton') holding the active upload provider.
const uploadSettingSchema = new mongoose.Schema({
  key: { type: String, default: 'singleton', unique: true },
  imageUploadProvider: { type: String, enum: ['local', 'cloudinary'], default: 'local' }
}, { timestamps: true });

export default mongoose.models.UploadSetting || mongoose.model('UploadSetting', uploadSettingSchema);
