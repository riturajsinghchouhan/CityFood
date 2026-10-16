/**
 * Money helpers — the ONE place money is rounded and compared.
 *
 * Amounts in the database are rupees (Number, 2 decimals). Doing arithmetic on those
 * directly causes drift (0.1 + 0.2 !== 0.3), so every calculation and comparison goes
 * through integer paise here.
 */

/** Rupees -> integer paise (safe for 1.005, 19.99 and similar). */
export const toPaise = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.round((n + Number.EPSILON) * 100);
};

/** Integer paise -> rupees (2 decimals). */
export const fromPaise = (paise) => Math.round(Number(paise) || 0) / 100;

/** Round a rupee amount to 2 decimals. */
export const round2 = (value) => fromPaise(toPaise(value));

/** Sum rupee amounts without floating-point drift. */
export const addMoney = (...values) => fromPaise(values.reduce((sum, v) => sum + toPaise(v), 0));

/** a - b without floating-point drift. */
export const subMoney = (a, b) => fromPaise(toPaise(a) - toPaise(b));

/** Percentage of an amount, rounded to paise. */
export const percentOf = (amount, percent) => fromPaise(Math.round(toPaise(amount) * (Number(percent) || 0) / 100));

export const eqMoney = (a, b) => toPaise(a) === toPaise(b);
export const gtMoney = (a, b) => toPaise(a) > toPaise(b);
export const gteMoney = (a, b) => toPaise(a) >= toPaise(b);
export const ltMoney = (a, b) => toPaise(a) < toPaise(b);
export const isPositiveMoney = (a) => toPaise(a) > 0;
