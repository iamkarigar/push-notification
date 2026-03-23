import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const SECTRT_KEY = process.env.SECTRT_KEY;
const REFRESH_KEY = process.env.REFRESH_KEY;

export function signToken(userId) {
  if (!JWT_SECRET) throw new Error("JWT_SECRET is required");
  return jwt.sign({ userId }, JWT_SECRET);
}

export function signAccessToken(userId) {
  if (!SECTRT_KEY) throw new Error("SECTRT_KEY is required");
  return jwt.sign({ userId }, SECTRT_KEY, { expiresIn: "15m" });
}

export function signRefreshToken(userId) {
  if (!REFRESH_KEY) throw new Error("REFRESH_KEY is required");
  return jwt.sign({ userId }, REFRESH_KEY, { expiresIn: "7d" });
}

export function verifyAccessToken(token) {
  if (!SECTRT_KEY) throw new Error("SECTRT_KEY is required");
  return jwt.verify(token, SECTRT_KEY);
}
