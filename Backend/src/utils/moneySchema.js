import { round2 } from './money.js';

/**
 * Makes rupee amounts on a schema EXACT.
 *
 * Every listed path gets a setter that rounds to whole paise (2 decimals) whenever a value is
 * written — through `new Model()`, `.save()`, `$set` or `findOneAndUpdate`. So a value like
 * 33.330000000000005 can never be stored, and every amount read back converts to an exact integer
 * number of paise via toPaise(). (The stored-value ledger goes further and stores integer paise.)
 *
 * Throws at startup if a path does not exist, so a typo can never silently skip a field.
 *
 * @param {import('mongoose').Schema} schema
 * @param {string[]} paths dotted paths; arrays of subdocuments are written as 'history.amount'
 */
export function roundMoneyPaths(schema, paths) {
    const setter = (v) => (v === undefined || v === null || Number.isNaN(Number(v)) ? v : round2(v));

    for (const path of paths) {
        let target = schema.path(path);
        if (!target) {
            const [head, ...rest] = path.split('.');
            const container = schema.path(head);
            if (container?.schema) target = container.schema.path(rest.join('.'));
        }
        if (!target) throw new Error(`roundMoneyPaths: unknown path "${path}"`);
        target.set(setter);
    }
}
