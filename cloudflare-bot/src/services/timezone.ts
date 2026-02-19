/**
 * Timezone utilities — parse, apply, and format UTC offsets
 *
 * Offsets are stored as strings: 'UTC', 'UTC+2', 'UTC-5:30', etc.
 * All internal storage and cron logic stays in UTC.
 * Offsets are applied only at input/output boundaries.
 */

/**
 * Parse a UTC offset string into total minutes.
 * 'UTC' → 0, 'UTC+2' → 120, 'UTC-5:30' → -330
 */
export function parseOffset(tz: string): number {
    if (!tz || tz === 'UTC') return 0;

    const match = tz.match(/^UTC([+-])(\d{1,2})(?::(\d{2}))?$/);
    if (!match) return 0;

    const sign = match[1] === '+' ? 1 : -1;
    const hours = parseInt(match[2], 10);
    const minutes = parseInt(match[3] || '0', 10);

    return sign * (hours * 60 + minutes);
}

/**
 * Apply a UTC offset to a Date, returning a new Date shifted by the offset.
 * Useful for display: UTC date + offset → "local" date.
 */
export function applyOffset(date: Date, tz: string): Date {
    const offsetMinutes = parseOffset(tz);
    return new Date(date.getTime() + offsetMinutes * 60_000);
}

/**
 * Remove a UTC offset from a local datetime, converting to UTC.
 * Useful for input: user enters local time → subtract offset → store UTC.
 */
export function toUTC(date: Date, tz: string): Date {
    const offsetMinutes = parseOffset(tz);
    return new Date(date.getTime() - offsetMinutes * 60_000);
}

/**
 * Format a UTC datetime string to the user's local time for display.
 * Returns "YYYY-MM-DD at HH:MM (UTC+X)" format.
 */
export function formatLocalTime(utcDateStr: string, tz: string): string {
    const utcDate = new Date(utcDateStr);
    const local = applyOffset(utcDate, tz);

    const yyyy = local.getUTCFullYear();
    const mm = String(local.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(local.getUTCDate()).padStart(2, '0');
    const hh = String(local.getUTCHours()).padStart(2, '0');
    const min = String(local.getUTCMinutes()).padStart(2, '0');

    const label = tz === 'UTC' ? 'UTC' : tz;
    return `${yyyy}-${mm}-${dd} at ${hh}:${min} (${label})`;
}

/**
 * Validate a timezone string format.
 * Accepts: 'UTC', 'UTC+N', 'UTC-N', 'UTC+N:MM', 'UTC-N:MM'
 */
export function isValidTimezone(tz: string): boolean {
    return tz === 'UTC' || /^UTC[+-]\d{1,2}(:\d{2})?$/.test(tz);
}
