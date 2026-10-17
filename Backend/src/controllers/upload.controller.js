import fs from 'fs';
import { ValidationError } from '../core/auth/errors.js';
import { sendSuccess } from '../utils/response.js';
import { useCloudinary, uploadBufferToCloudinary } from '../utils/cloudinary.js';

const folderFromReq = (req) => {
    const raw = typeof req.body?.folder === 'string' ? req.body.folder.trim() : '';
    return raw.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'misc';
};

const resourceTypeFor = (mimeType) => {
    if (String(mimeType).startsWith('image/')) return 'image';
    if (String(mimeType).startsWith('video/')) return 'video';
    return 'raw';
};

// Multer has already written the file to disk. When Cloudinary is active, push it
// there, drop the temp file, and return the Cloudinary URL; otherwise keep local.
const toFileData = async (file, subFolder) => {
    let url = `/uploads/${file.filename}`;
    let publicId = null;

    if (await useCloudinary()) {
        const uploaded = await uploadBufferToCloudinary(fs.readFileSync(file.path), {
            subFolder,
            resourceType: resourceTypeFor(file.mimetype)
        });
        url = uploaded.url;
        publicId = uploaded.publicId;
        fs.unlink(file.path, () => {});
    }

    return {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: url,
        url,
        publicId
    };
};

export const uploadSingle = async (req, res, next) => {
    try {
        if (!req.file) {
            throw new ValidationError('No file provided or invalid file format.');
        }

        const fileData = await toFileData(req.file, folderFromReq(req));

        return sendSuccess(res, {
            success: true,
            file: fileData
        });
    } catch (error) {
        next(error);
    }
};

export const uploadMultiple = async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            throw new ValidationError('No files provided or invalid formats.');
        }

        const subFolder = folderFromReq(req);
        const filesData = await Promise.all(req.files.map((file) => toFileData(file, subFolder)));

        return sendSuccess(res, {
            success: true,
            files: filesData
        });
    } catch (error) {
        next(error);
    }
};
