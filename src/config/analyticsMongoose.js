import mongoose from "mongoose";

let analyticsConn = null;

export function getAnalyticsMongooseConnection() {
  if (analyticsConn) return analyticsConn;
  const uri = process.env.ANALYTICS_MONGO_URL;
  if (!uri) {
    throw new Error("ANALYTICS_MONGO_URL is required for scheduled notification model");
  }
  const dbName = String(process.env.ANALYTICS_DB_NAME || "referral").trim() || "referral";
  analyticsConn = mongoose.createConnection(uri, { dbName });
  analyticsConn.on("error", (err) => {
    console.error("[analyticsMongoose] connection error:", err?.message || err);
  });
  return analyticsConn;
}

