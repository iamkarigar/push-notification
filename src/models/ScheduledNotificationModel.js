import mongoose from "mongoose";
import { getAnalyticsMongooseConnection } from "../config/analyticsMongoose.js";

const scheduledNotificationSchema = new mongoose.Schema(
  {
    app: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      enum: ["users", "merchants", "architect", "worker"],
    },
    version: { type: String, default: "all", trim: true },
    platform: { type: String, default: "all", trim: true, lowercase: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    data: { type: Object, default: {} },
    isTest: { type: Boolean, default: false },
    targetNumbers: { type: [String], default: [] },
    scheduledFor: { type: Date, required: true },
    timezone: { type: String, default: "Asia/Kolkata" },
    status: {
      type: String,
      enum: ["pending", "processing", "forwarded", "failed", "cancelled"],
      default: "pending",
    },
    analyticsDispatch: {
      endpoint: { type: String, default: null },
      dispatchedAt: { type: Date, default: null },
      acknowledged: { type: Boolean, default: false },
      response: { type: Object, default: null },
      error: { type: String, default: null },
    },
    createdByAdminId: { type: mongoose.Schema.Types.ObjectId, default: null },
    processingAt: { type: Date, default: null },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

scheduledNotificationSchema.index({ scheduledFor: 1, status: 1 });

const MODEL = "ScheduledNotification";

export function getScheduledNotificationModel() {
  const conn = getAnalyticsMongooseConnection();
  if (conn.models[MODEL]) return conn.models[MODEL];
  const coll =
    String(process.env.ANALYTICS_SCHEDULED_NOTIFICATION_COLLECTION || "scheduled_notifications")
      .trim() || "scheduled_notifications";
  return conn.model(MODEL, scheduledNotificationSchema, coll);
}

