import { getUploadProvider, setUploadProvider, isCloudinaryConfigured } from '../../utils/cloudinary.js';
import { resolveUploadRoot } from '../../utils/uploadPaths.js';

export const getUploadSettings = async (req, res) => {
    res.json({
        success: true,
        data: {
            imageUploadProvider: await getUploadProvider(),
            cloudinaryConfigured: isCloudinaryConfigured(),
            nodeEnv: process.env.NODE_ENV || 'development',
            localUploadDir: resolveUploadRoot()
        }
    });
};

export const updateUploadSettings = async (req, res) => {
    const { imageUploadProvider } = req.body || {};
    if (!['local', 'cloudinary'].includes(imageUploadProvider)) {
        return res.status(400).json({ success: false, message: 'imageUploadProvider must be "local" or "cloudinary"' });
    }
    if (imageUploadProvider === 'cloudinary' && !isCloudinaryConfigured()) {
        return res.status(400).json({
            success: false,
            message: 'Cloudinary is not configured on the server (missing CLOUDINARY_* env vars)'
        });
    }
    const saved = await setUploadProvider(imageUploadProvider);
    res.json({ success: true, data: { imageUploadProvider: saved } });
};
