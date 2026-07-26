import { Expo } from "expo-server-sdk";
import EquipmentBookingModel from "../models/EquipmentBookingModel.js";
import userModel from "../models/UserModel.js";
import {
  sendNotificationUserApp,
  sendNotificationUserAppBulk,
} from "../controllers/notificationController.js";

/** Avoid double sends when both HTTP + change stream fire for the same event. */
const recentNotifyKeys = new Map();
const NOTIFY_DEDUPE_MS = 60 * 1000;

function seenNotifyRecently(key) {
  const now = Date.now();
  for (const [k, ts] of recentNotifyKeys) {
    if (now - ts > NOTIFY_DEDUPE_MS) recentNotifyKeys.delete(k);
  }
  const last = recentNotifyKeys.get(key);
  if (last && now - last < NOTIFY_DEDUPE_MS) return true;
  recentNotifyKeys.set(key, now);
  return false;
}

const formatAmountINR = (amount) => {
  if (amount == null || Number.isNaN(Number(amount))) return "";
  return `₹${Number(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

const equipmentTitle = (booking) =>
  booking?.equipmentSnapshot?.title || "your equipment";

function collectPushTokens(user) {
  const out = [];
  const seen = new Set();
  const add = (raw) => {
    const s = raw != null ? String(raw).trim() : "";
    if (!s || !Expo.isExpoPushToken(s) || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  add(user?.pushToken);
  if (Array.isArray(user?.pushTokens)) {
    for (const t of user.pushTokens) add(t);
  }
  return out;
}

async function pushToUser(userId, title, body, data = {}) {
  if (!userId) {
    return { success: false, message: "Missing user id" };
  }
  const user = await userModel
    .findById(userId)
    .select("pushToken pushTokens name")
    .lean();
  if (!user) {
    return { success: false, message: "User not found", userId: String(userId) };
  }
  const tokens = collectPushTokens(user);
  if (!tokens.length) {
    return {
      success: false,
      message: "Push token not found",
      userId: String(userId),
    };
  }
  try {
    const result =
      tokens.length === 1
        ? await sendNotificationUserApp(tokens[0], title, body, data)
        : await sendNotificationUserAppBulk(tokens, title, body, data);
    return { success: true, userId: String(userId), result };
  } catch (error) {
    console.warn(
      "equipment booking pushToUser error:",
      error?.message || error
    );
    return {
      success: false,
      message: error?.message || "push failed",
      userId: String(userId),
    };
  }
}

function dateBit(booking) {
  if (!booking?.bookingDate) return "";
  if (booking.bookingEndDate) {
    return ` (${booking.bookingDate} → ${booking.bookingEndDate})`;
  }
  return ` on ${booking.bookingDate}`;
}

/**
 * Rental order initiated (pending payment).
 * Notifies renter + contractor/owner.
 */
export async function notifyEquipmentBookingInitiatedFromDoc(booking) {
  if (!booking?._id) {
    return { success: false, message: "Invalid booking" };
  }

  const dedupeKey = `initiated:${String(booking._id)}`;
  if (seenNotifyRecently(dedupeKey)) {
    return {
      success: true,
      bookingId: String(booking._id),
      deduped: true,
      results: [],
    };
  }

  const title = equipmentTitle(booking);
  const amount = formatAmountINR(booking.totalAmount);
  const results = [];

  results.push(
    await pushToUser(
      booking.renterId,
      "Rental order initiated",
      amount
        ? `Complete payment of ${amount} to confirm your booking for "${title}".`
        : `Complete payment to confirm your booking for "${title}".`,
      {
        screen: "equipment-bookings-my",
        bookingId: booking._id,
        equipmentId: booking.equipmentId,
        status: booking.status || "pending_payment",
        type: "equipment_booking_initiated",
      }
    )
  );

  results.push(
    await pushToUser(
      booking.ownerId,
      "New rental booking request",
      `Someone initiated a booking for "${title}". Waiting for payment.`,
      {
        screen: "equipment-bookings-received",
        bookingId: booking._id,
        equipmentId: booking.equipmentId,
        status: booking.status || "pending_payment",
        type: "equipment_booking_initiated_owner",
      }
    )
  );

  return { success: true, bookingId: String(booking._id), results };
}

/**
 * Payment done / booking confirmed.
 * Notifies renter + contractor: "You have a booking for XYZ".
 */
export async function notifyEquipmentBookingConfirmedFromDoc(booking) {
  if (!booking?._id) {
    return { success: false, message: "Invalid booking" };
  }

  const dedupeKey = `confirmed:${String(booking._id)}`;
  if (seenNotifyRecently(dedupeKey)) {
    return {
      success: true,
      bookingId: String(booking._id),
      deduped: true,
      results: [],
    };
  }

  const title = equipmentTitle(booking);
  const amount = formatAmountINR(booking.totalAmount);
  const when = dateBit(booking);
  const results = [];

  results.push(
    await pushToUser(
      booking.renterId,
      "Payment successful",
      amount
        ? `Your rental for "${title}" is confirmed${when}. Paid ${amount}.`
        : `Your rental for "${title}" is confirmed${when}.`,
      {
        screen: "equipment-bookings-my",
        bookingId: booking._id,
        equipmentId: booking.equipmentId,
        status: "confirmed",
        type: "equipment_booking_confirmed",
      }
    )
  );

  results.push(
    await pushToUser(
      booking.ownerId,
      "New equipment booking",
      `You have a booking for "${title}"${when}.`,
      {
        screen: "equipment-bookings-received",
        bookingId: booking._id,
        equipmentId: booking.equipmentId,
        status: "confirmed",
        type: "equipment_booking_owner",
      }
    )
  );

  return { success: true, bookingId: String(booking._id), results };
}

export async function notifyEquipmentBookingInitiated(bookingId) {
  const booking = await EquipmentBookingModel.findById(bookingId).lean();
  if (!booking) {
    return { success: false, message: "Booking not found" };
  }
  return notifyEquipmentBookingInitiatedFromDoc(booking);
}

export async function notifyEquipmentBookingConfirmed(bookingId) {
  const booking = await EquipmentBookingModel.findById(bookingId).lean();
  if (!booking) {
    return { success: false, message: "Booking not found" };
  }
  return notifyEquipmentBookingConfirmedFromDoc(booking);
}
