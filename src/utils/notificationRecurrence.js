/**
 * Recurring schedule helpers (Asia/Kolkata, fixed UTC+5:30 — no DST).
 * frequency: once | daily | weekly | monthly
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const RECURRENCE_FREQUENCIES = ["once", "daily", "weekly", "monthly"];

export function toIstParts(date) {
  const d = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    weekday: d.getUTCDay(), // 0=Sun … 6=Sat
  };
}

export function fromIstParts({ year, month, day, hour = 0, minute = 0, second = 0 }) {
  return new Date(Date.UTC(year, month, day, hour, minute, second) - IST_OFFSET_MS);
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function clampDayOfMonth(year, month, dayOfMonth) {
  return Math.min(Math.max(1, dayOfMonth), daysInMonth(year, month));
}

/**
 * @param {object} opts
 * @param {Date} opts.from - reference instant (usually "now" or last fire time)
 * @param {'once'|'daily'|'weekly'|'monthly'} opts.frequency
 * @param {number|null} [opts.dayOfWeek] - 0=Sun … 6=Sat (weekly)
 * @param {number|null} [opts.dayOfMonth] - 1–31 (monthly)
 * @param {number} opts.hour - IST hour 0–23
 * @param {number} opts.minute - IST minute 0–59
 * @param {boolean} [opts.strictlyAfter=true] - if true, result must be > from
 */
export function computeNextScheduledFor({
  from,
  frequency,
  dayOfWeek = null,
  dayOfMonth = null,
  hour,
  minute,
  strictlyAfter = true,
}) {
  const fromDate = from instanceof Date ? from : new Date(from);
  if (Number.isNaN(fromDate.getTime())) {
    throw new Error("Invalid from date");
  }

  const freq = String(frequency || "once").toLowerCase();
  if (freq === "once") {
    return null;
  }

  const h = Number(hour);
  const m = Number(minute);
  if (!Number.isFinite(h) || h < 0 || h > 23 || !Number.isFinite(m) || m < 0 || m > 59) {
    throw new Error("Valid hour (0–23) and minute (0–59) are required for recurrence");
  }

  const ist = toIstParts(fromDate);
  const compare = (candidate) =>
    strictlyAfter ? candidate.getTime() > fromDate.getTime() : candidate.getTime() >= fromDate.getTime();

  if (freq === "daily") {
    let candidate = fromIstParts({
      year: ist.year,
      month: ist.month,
      day: ist.day,
      hour: h,
      minute: m,
    });
    if (!compare(candidate)) {
      candidate = fromIstParts({
        year: ist.year,
        month: ist.month,
        day: ist.day + 1,
        hour: h,
        minute: m,
      });
    }
    return candidate;
  }

  if (freq === "weekly") {
    const targetDow = Number(dayOfWeek);
    if (!Number.isFinite(targetDow) || targetDow < 0 || targetDow > 6) {
      throw new Error("dayOfWeek must be 0 (Sun) through 6 (Sat) for weekly recurrence");
    }
    for (let add = 0; add <= 7; add++) {
      const candidate = fromIstParts({
        year: ist.year,
        month: ist.month,
        day: ist.day + add,
        hour: h,
        minute: m,
      });
      const parts = toIstParts(candidate);
      if (parts.weekday === targetDow && compare(candidate)) {
        return candidate;
      }
    }
    throw new Error("Could not compute next weekly occurrence");
  }

  if (freq === "monthly") {
    const targetDom = Number(dayOfMonth);
    if (!Number.isFinite(targetDom) || targetDom < 1 || targetDom > 31) {
      throw new Error("dayOfMonth must be 1–31 for monthly recurrence");
    }
    for (let monthOffset = 0; monthOffset <= 24; monthOffset++) {
      const y = ist.year + Math.floor((ist.month + monthOffset) / 12);
      const mo = (ist.month + monthOffset) % 12;
      const day = clampDayOfMonth(y, mo, targetDom);
      const candidate = fromIstParts({ year: y, month: mo, day, hour: h, minute: m });
      if (compare(candidate)) return candidate;
    }
    throw new Error("Could not compute next monthly occurrence");
  }

  throw new Error(`Unsupported recurrence frequency: ${freq}`);
}

export function normalizeRecurrence(input = {}, timeFromDate = null) {
  const raw = input && typeof input === "object" ? input : {};
  let frequency = String(raw.frequency || "once")
    .trim()
    .toLowerCase();
  if (!RECURRENCE_FREQUENCIES.includes(frequency)) {
    frequency = "once";
  }

  const enabled = frequency !== "once" && (raw.enabled !== false);
  const dayOfWeek =
    raw.dayOfWeek != null && raw.dayOfWeek !== ""
      ? Number(raw.dayOfWeek)
      : null;
  const dayOfMonth =
    raw.dayOfMonth != null && raw.dayOfMonth !== ""
      ? Number(raw.dayOfMonth)
      : null;

  let hour = raw.hour != null && raw.hour !== "" ? Number(raw.hour) : null;
  let minute = raw.minute != null && raw.minute !== "" ? Number(raw.minute) : null;

  if ((hour == null || minute == null) && timeFromDate instanceof Date && !Number.isNaN(timeFromDate.getTime())) {
    const parts = toIstParts(timeFromDate);
    if (hour == null) hour = parts.hour;
    if (minute == null) minute = parts.minute;
  }

  let endsAt = null;
  if (raw.endsAt) {
    const e = new Date(raw.endsAt);
    if (!Number.isNaN(e.getTime())) endsAt = e;
  }

  if (!enabled || frequency === "once") {
    return {
      enabled: false,
      frequency: "once",
      dayOfWeek: null,
      dayOfMonth: null,
      hour: null,
      minute: null,
      endsAt: null,
    };
  }

  if (hour == null || minute == null) {
    throw new Error("Recurring schedules require a time of day (from scheduledFor or hour/minute)");
  }

  if (frequency === "weekly") {
    if (!Number.isFinite(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      throw new Error("Weekly recurrence requires dayOfWeek (0=Sun … 6=Sat)");
    }
  }
  if (frequency === "monthly") {
    if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      throw new Error("Monthly recurrence requires dayOfMonth (1–31)");
    }
  }

  return {
    enabled: true,
    frequency,
    dayOfWeek: frequency === "weekly" ? dayOfWeek : null,
    dayOfMonth: frequency === "monthly" ? dayOfMonth : null,
    hour,
    minute,
    endsAt,
  };
}

export function formatRecurrenceLabel(recurrence) {
  if (!recurrence?.enabled || recurrence.frequency === "once") return "Once";
  const hh = String(recurrence.hour ?? 0).padStart(2, "0");
  const mm = String(recurrence.minute ?? 0).padStart(2, "0");
  const time = `${hh}:${mm} IST`;
  if (recurrence.frequency === "daily") return `Daily at ${time}`;
  if (recurrence.frequency === "weekly") {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const name = names[recurrence.dayOfWeek] || "?";
    return `Every ${name} at ${time}`;
  }
  if (recurrence.frequency === "monthly") {
    return `Monthly on day ${recurrence.dayOfMonth} at ${time}`;
  }
  return recurrence.frequency;
}

export function isRecurring(doc) {
  return !!(doc?.recurrence?.enabled && doc.recurrence.frequency && doc.recurrence.frequency !== "once");
}
