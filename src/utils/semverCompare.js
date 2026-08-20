/**
 * Lightweight semver-ish compare for app versions like "1.2.8", "2.0.0-beta".
 * Non-numeric suffixes are ignored for ordering; missing parts treated as 0.
 */

export function parseVersionParts(version) {
  const raw = String(version || "")
    .trim()
    .toLowerCase()
    .replace(/^v/, "");
  if (!raw || raw === "all") return null;
  const core = raw.split(/[-+_]/)[0];
  const parts = core.split(".").map((p) => {
    const n = parseInt(p.replace(/[^\d].*$/, ""), 10);
    return Number.isFinite(n) ? n : 0;
  });
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 4);
}

/** @returns {number} negative if a < b, 0 if equal, positive if a > b; null if unparsable */
export function compareVersions(a, b) {
  const pa = parseVersionParts(a);
  const pb = parseVersionParts(b);
  if (!pa || !pb) return null;
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

export const VERSION_OPERATORS = ["eq", "lt", "lte", "gt", "gte"];

export function normalizeVersionOperator(op) {
  const v = String(op || "eq")
    .trim()
    .toLowerCase();
  if (VERSION_OPERATORS.includes(v)) return v;
  // aliases
  if (v === "=" || v === "==" || v === "exact") return "eq";
  if (v === "<" || v === "before" || v === "older") return "lt";
  if (v === "<=" || v === "older_or_equal") return "lte";
  if (v === ">" || v === "after" || v === "newer") return "gt";
  if (v === ">=" || v === "newer_or_equal") return "gte";
  return "eq";
}

/**
 * @param {string|null|undefined} userVersion
 * @param {string} targetVersion
 * @param {string} operator
 */
export function versionMatches(userVersion, targetVersion, operator = "eq") {
  const target = String(targetVersion || "")
    .trim()
    .toLowerCase();
  if (!target || target === "all") return true;

  const op = normalizeVersionOperator(operator);
  const cmp = compareVersions(userVersion, target);
  if (cmp == null) return false;

  switch (op) {
    case "lt":
      return cmp < 0;
    case "lte":
      return cmp <= 0;
    case "gt":
      return cmp > 0;
    case "gte":
      return cmp >= 0;
    case "eq":
    default:
      return cmp === 0;
  }
}

export function formatVersionOperatorLabel(operator, version) {
  const v = String(version || "all").trim() || "all";
  if (!v || v.toLowerCase() === "all") return "All versions";
  const op = normalizeVersionOperator(operator);
  const map = {
    eq: `= ${v}`,
    lt: `< ${v}`,
    lte: `≤ ${v}`,
    gt: `> ${v}`,
    gte: `≥ ${v}`,
  };
  return map[op] || `= ${v}`;
}
