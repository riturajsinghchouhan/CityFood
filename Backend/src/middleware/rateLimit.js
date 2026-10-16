import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

const windowMs = config.rateLimitWindowMinutes * 60 * 1000;

export const apiRateLimiter = rateLimit({
    windowMs,
    // Dev UX: local UI can generate lots of background API calls (location, polling, etc).
    // Keep production strict, but avoid blocking local development.
    max: config.nodeEnv === 'development' ? Math.max(config.rateLimitMaxRequests, 2000) : config.rateLimitMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        if (req.user && req.user.userId) {
            return req.user.userId.toString();
        }
        const forwarded = req.headers['x-forwarded-for'];
        const realIp = req.headers['x-real-ip'];
        const ip = forwarded ? forwarded.split(',')[0].trim() : realIp || req.ip;
        return ip;
    },
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    }
});

const authWindowMs = config.authRateLimitWindowMinutes * 60 * 1000;

/** Stricter rate limit for auth routes (OTP, login, refresh, logout). Applied in addition to global limiter. */
export const authRateLimiter = rateLimit({
    windowMs: authWindowMs,
    // Dev UX: login/otp testing can be frequent. Keep production strict (e.g. 30), 
    // but relax local development to avoid 429 when testing flows.
    max: config.nodeEnv === 'development' ? Math.max(config.authRateLimitMax, 100) : config.authRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const forwarded = req.headers['x-forwarded-for'];
        const realIp = req.headers['x-real-ip'];
        const ip = forwarded ? forwarded.split(',')[0].trim() : realIp || req.ip;
        return ip;
    },
    message: {
        success: false,
        message: 'Too many authentication attempts. Please try again later.'
    }
});


/**
 * Strict limit for endpoints that move money (wallet top-up, withdrawal requests, cash deposits,
 * payment verification). Applied AFTER authentication so it counts per user, in addition to the
 * global limiter. A normal person never comes near this; a script hammering a payout endpoint does.
 */
export const moneyRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: config.nodeEnv === 'development' ? 200 : 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        if (req.user && req.user.userId) return `money:${req.user.userId.toString()}`;
        const forwarded = req.headers['x-forwarded-for'];
        const realIp = req.headers['x-real-ip'];
        return `money:${forwarded ? forwarded.split(',')[0].trim() : realIp || req.ip}`;
    },
    message: {
        success: false,
        message: 'Too many payment requests. Please wait a few minutes and try again.'
    }
});
