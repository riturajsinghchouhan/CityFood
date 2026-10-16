import { v2 as cloudinary } from 'cloudinary';
import UploadSetting from '../models/UploadSetting.js';

let configured = false;

// True when the server has Cloudinary credentials (env only).
export const isCloudinaryConfigured = () =>
    Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );

// Active provider chosen by the admin toggle ('local' | 'cloudinary'), cached briefly.
let providerCache = { value: 'local', expiresAt: 0 };

export const getUploadProvider = async () => {
    if (providerCache.expiresAt > Date.now()) return providerCache.value;
    let value = 'local';
    try {
        const doc = await UploadSetting.findOne({ key: 'singleton' }).lean();
        value = doc?.imageUploadProvider || 'local';
    } catch {
        // DB unavailable -> fall back to local
    }
    providerCache = { value, expiresAt: Date.now() + 15 * 1000 };
    return value;
};

export const setUploadProvider = async (imageUploadProvider) => {
    const doc = await UploadSetting.findOneAndUpdate(
        { key: 'singleton' },
        { imageUploadProvider },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    providerCache = { value: doc.imageUploadProvider, expiresAt: Date.now() + 15 * 1000 };
    return doc.imageUploadProvider;
};

// Use Cloudinary only when it is selected in settings AND credentials exist.
export const useCloudinary = async () =>
    isCloudinaryConfigured() && (await getUploadProvider()) === 'cloudinary';

const ensureConfigured = () => {
    if (configured) return;
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
    });
    configured = true;
};

/**
 * Streams a buffer to the Cloudinary root (no folder, no subfolders).
 * Returns { url, publicId }.
 */
export const uploadBufferToCloudinary = (buffer, { resourceType = 'image', format } = {}) => {
    ensureConfigured();
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: resourceType, ...(format ? { format } : {}) },
            (err, result) => {
                if (err) return reject(err);
                resolve({ url: result.secure_url, publicId: result.public_id });
            }
        );
        stream.end(buffer);
    });
};

export const destroyFromCloudinary = (publicId, resourceType = 'image') => {
    if (!publicId) return Promise.resolve();
    ensureConfigured();
    return cloudinary.uploader.destroy(publicId, { resource_type: resourceType }).catch(() => {});
};
