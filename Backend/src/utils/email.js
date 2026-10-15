import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { logger } from './logger.js';

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;
    const { emailHost, emailPort, emailUser, emailPass } = config;
    if (!emailHost || !emailUser || !emailPass) {
        logger.warn('Email not configured: EMAIL_HOST, EMAIL_USER, EMAIL_PASS required');
        return null;
    }
    transporter = nodemailer.createTransport({
        host: emailHost,
        port: emailPort || 587,
        secure: emailPort === 465,
        auth: {
            user: emailUser,
            pass: emailPass
        }
    });
    return transporter;
}

/**
 * Send OTP email for admin forgot password.
 * @param {string} to - Recipient email
 * @param {string} otp - 6-digit OTP
 * @returns {Promise<boolean>} true if sent, false if skipped/failed
 */
export async function sendAdminResetOtpEmail(to, otp) {
    const trans = getTransporter();
    if (!trans) {
        logger.warn('Admin OTP email skipped: SMTP not configured');
        return false;
    }
    const from = config.emailFrom || config.emailUser;
    const subject = 'Your password reset code – CityFood Admin';
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 480px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111;">Password reset code</h2>
  <p>Use the code below to reset your admin password. It is valid for 10 minutes.</p>
  <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; background: #f5f5f5; padding: 12px 16px; border-radius: 8px;">${otp}</p>
  <p style="color: #666; font-size: 14px;">If you did not request this, you can ignore this email.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 12px;">CityFood Admin</p>
</body>
</html>`;
    const text = `Your password reset code is: ${otp}. It is valid for 10 minutes. If you did not request this, ignore this email.`;

    try {
        await trans.sendMail({
            from: typeof from === 'string' && from.includes('<') ? from : `CityFood <${from}>`,
            to,
            subject,
            text,
            html
        });
        logger.info(`Admin reset OTP email sent to ${to}`);
        return true;
    } catch (err) {
        logger.error(`Failed to send admin OTP email to ${to}:`, err.message);
        return false;
    }
}

/**
 * Send welcome email with T&C PDF to new restaurant owner.
 * @param {string} to - Recipient email
 * @param {string} restaurantName - Name of the restaurant
 * @param {string} pdfUrl - URL to the T&C PDF
 * @returns {Promise<boolean>} true if sent, false if skipped/failed
 */
export async function sendRestaurantOnboardingEmail(to, restaurantName, pdfUrl) {
    const trans = getTransporter();
    if (!trans) {
        logger.warn('Restaurant onboarding email skipped: SMTP not configured');
        return false;
    }
    const from = config.emailFrom || config.emailUser;
    const subject = `Welcome to CityFood, ${restaurantName}!`;
    
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111;">Welcome aboard, ${restaurantName}!</h2>
  <p>Your restaurant has been successfully onboarded to CityFood.</p>
  <p>Please find attached the official Terms and Conditions regarding our partnership.</p>
  <p>We look forward to growing together!</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 12px;">CityFood Team</p>
</body>
</html>`;
    
    const text = `Welcome aboard, ${restaurantName}!\n\nYour restaurant has been successfully onboarded to CityFood.\nPlease find attached the official Terms and Conditions regarding our partnership.\n\nWe look forward to growing together!\n\nCityFood Team`;

    const mailOptions = {
        from: typeof from === 'string' && from.includes('<') ? from : `CityFood <${from}>`,
        to,
        subject,
        text,
        html,
    };

    if (pdfUrl) {
        mailOptions.attachments = [
            {
                filename: 'Terms_and_Conditions.pdf',
                path: pdfUrl // Nodemailer supports fetching directly from a URL
            }
        ];
    }

    try {
        await trans.sendMail(mailOptions);
        logger.info(`Restaurant onboarding email sent to ${to} (${restaurantName})`);
        return true;
    } catch (err) {
        logger.error(`Failed to send onboarding email to ${to}:`, err.message);
        return false;
    }
}

const SETTLEMENT_EMAIL_COPY = {
    restaurant_payout: {
        subject: 'Your payout has been settled',
        heading: 'Payout settled',
        line: (formattedAmount) => `Admin has settled a payout of ${formattedAmount} to your account.`
    },
    delivery_payout: {
        subject: 'Your payout has been settled',
        heading: 'Payout settled',
        line: (formattedAmount) => `Admin has settled a payout of ${formattedAmount} to your account.`
    },
    cash_limit: {
        subject: 'Your cash-in-hand has been settled',
        heading: 'Cash-in-hand settled',
        line: (formattedAmount) => `Admin has recorded a cash collection of ${formattedAmount} against your account, freeing up your cash limit.`
    }
};

/**
 * Send a settlement notification email (restaurant payout, delivery payout, or delivery
 * cash-limit settlement) when admin settles an amount on the user's behalf.
 * @param {string} to - Recipient email
 * @param {{ recipientName?: string, amount: number, type: 'restaurant_payout'|'delivery_payout'|'cash_limit', transactionId?: string, adminNote?: string }} details
 * @returns {Promise<boolean>} true if sent, false if skipped/failed
 */
export async function sendSettlementEmail(to, { recipientName, amount, type, transactionId, adminNote } = {}) {
    if (!to) return false;
    const trans = getTransporter();
    if (!trans) {
        logger.warn('Settlement email skipped: SMTP not configured');
        return false;
    }

    const copy = SETTLEMENT_EMAIL_COPY[type] || SETTLEMENT_EMAIL_COPY.restaurant_payout;
    const from = config.emailFrom || config.emailUser;
    const formattedAmount = `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const bodyLine = copy.line(formattedAmount);
    const subject = `${copy.subject} – CityFood`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 480px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111;">${copy.heading}</h2>
  <p>Hi ${recipientName || ''},</p>
  <p>${bodyLine}</p>
  <p style="font-size: 20px; font-weight: bold; background: #f5f5f5; padding: 12px 16px; border-radius: 8px;">${formattedAmount}</p>
  ${transactionId ? `<p style="color: #666; font-size: 14px;">Reference: ${transactionId}</p>` : ''}
  ${adminNote ? `<p style="color: #666; font-size: 14px;">Note: ${adminNote}</p>` : ''}
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 12px;">CityFood</p>
</body>
</html>`;
    const text = `${bodyLine} Amount: ${formattedAmount}.${transactionId ? ` Reference: ${transactionId}.` : ''}`;

    try {
        await trans.sendMail({
            from: typeof from === 'string' && from.includes('<') ? from : `CityFood <${from}>`,
            to,
            subject,
            text,
            html
        });
        logger.info(`Settlement email (${type}) sent to ${to}`);
        return true;
    } catch (err) {
        logger.error(`Failed to send settlement email to ${to}:`, err.message);
        return false;
    }
}
