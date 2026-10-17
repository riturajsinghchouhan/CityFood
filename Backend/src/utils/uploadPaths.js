import path from 'path';

// NODE_ENV-based default when UPLOAD_DIR / UPLOAD_PATH aren't set:
// development -> <cwd>/uploads, production -> /var/www/uploads
export const defaultUploadRoot = () =>
    process.env.NODE_ENV === 'production'
        ? '/var/www/uploads'
        : path.join(process.cwd(), 'uploads');

export const resolveUploadRoot = () =>
    process.env.UPLOAD_DIR || process.env.UPLOAD_PATH || defaultUploadRoot();
