import { Expo } from "expo-server-sdk";
import userModel from "../models/UserModel.js";

const expo = new Expo();

/**
 * Team mobiles (Karigar `users` collection `mobile_number`) that receive internal Expo alerts.
 * Edit this list as needed.
 */
export const TEAM_EXPO_NOTIFY_MOBILE_NUMBERS = ["919318455101", "919876543211"];

function collectUserExpoTokens(user) {
  const out = [];
  if (user?.pushToken && Expo.isExpoPushToken(String(user.pushToken).trim())) {
    out.push(String(user.pushToken).trim());
  }
  if (Array.isArray(user?.pushTokens)) {
    for (const t of user.pushTokens) {
      const s = t != null ? String(t).trim() : "";
      if (s && Expo.isExpoPushToken(s)) out.push(s);
    }
  }
  return [...new Set(out)];
}

/**
 * Find users by `TEAM_EXPO_NOTIFY_MOBILE_NUMBERS` and send an Expo push to every valid token
 * (`pushToken` + `pushTokens` per Karigar_server-new- user schema).
 *
 * @param {string} title
 * @param {string} text - notification body
 * @param {Record<string, unknown>} [data] - optional payload for the client
 * @returns {Promise<{ success: boolean, usersMatched: number, tokenCount: number, tickets?: unknown[] }>}
 */
export async function sendExpoToUsersByBroadcastMobiles(title, text, data = {}) {
  if (!title || typeof text !== "string") {
    return { success: false, usersMatched: 0, tokenCount: 0, error: "title and text are required" };
  }

  const mobiles = TEAM_EXPO_NOTIFY_MOBILE_NUMBERS.map((m) => String(m).trim()).filter(Boolean);
  if (mobiles.length === 0) {
    return { success: false, usersMatched: 0, tokenCount: 0, error: "TEAM_EXPO_NOTIFY_MOBILE_NUMBERS is empty" };
  }

  const users = await userModel
    .find({ mobile_number: { $in: mobiles } })
    .select("pushToken pushTokens mobile_number")
    .lean();

  const allTokens = new Set();
  for (const u of users) {
    for (const t of collectUserExpoTokens(u)) {
      allTokens.add(t);
    }
  }

  const tokens = [...allTokens];
  if (tokens.length === 0) {
    return {
      success: true,
      usersMatched: users.length,
      tokenCount: 0,
      message: "No valid Expo tokens for matched users",
    };
  }

  const messages = tokens.map((to) => ({
    to,
    title,
    body: text,
    data: data || {},
    channelId: "custom-sound-channel",
    sound: "normal_notification.wav",
    priority: "high",
    _contentAvailable: true,
  }));

  const tickets = await expo.sendPushNotificationsAsync(messages);
  return {
    success: true,
    usersMatched: users.length,
    tokenCount: tokens.length,
    tickets,
  };
}

/**
 * Notify team (Expo) that a new order was received, attributed to a merchant / business name.
 *
 * @param {string} receivedByName - e.g. merchant business name (XYZ)
 * @param {Record<string, unknown>} [data] - extra payload (e.g. orderId)
 */
export async function notifyTeamNewOrderReceivedExpo(receivedByName, data = {}) {
  const name = String(receivedByName || "").trim() || "a merchant";
  const title = "New order received";
  const text = `A new order is received by ${name}. Please have a look at it.`;
  return sendExpoToUsersByBroadcastMobiles(title, text, {
    type: "team_new_order",
    ...data,
  });
}

/** Fixed message — no order/merchant data required. */
export async function notifyTeamSimpleNewOrderExpo() {
  return sendExpoToUsersByBroadcastMobiles(
    "New order",
    "There is a new order. Please check the dashboard.",
    { type: "team_new_order_simple" }
  );
}

/**
 * Notify team (Expo) when a checkout is initiated (payment pending).
 *
 * @param {string} materialName - product/material label
 * @param {string|number} amount - order amount shown in notification
 * @param {Record<string, unknown>} [data] - extra payload (e.g. orderId, userId)
 */
export async function notifyTeamOrderInitiatedExpo(materialName, amount, data = {}) {
  const safeMaterial = String(materialName || "").trim() || "material";
  const safeAmount = String(amount ?? "").trim() || "0";
  const title = "Order initiated";
  const text = `Someone is trying to buy ${safeMaterial} for ${safeAmount}.`;
  return sendExpoToUsersByBroadcastMobiles(title, text, {
    type: "team_order_initiated",
    ...data,
  });
}

/**
 * Notify team (Expo) that a new labour (worker) registered — ask them to review and verify.
 *
 * @param {string} labourLabel - display name and/or phone for the push body
 * @param {Record<string, unknown>} [data] - extra payload (e.g. labourId)
 */
export async function notifyTeamNewLabourRegisteredExpo(labourLabel, data = {}) {
  const label = String(labourLabel || "").trim() || "A worker";
  const title = "New labour registered";
  const text = `${label} has registered as a labour. Please review and verify.`;
  return sendExpoToUsersByBroadcastMobiles(title, text, {
    type: "team_new_labour_registered",
    ...data,
  });
}

/**
 * Notify team (Expo) that a merchant logged in — ask them to review documents and verify.
 *
 * @param {string} merchantSummary - short line (e.g. business · name · mobile)
 * @param {Record<string, unknown>} [data] - extra payload (e.g. merchantId, is_verified)
 */
export async function notifyTeamNewMerchantLoggedInExpo(merchantSummary, data = {}) {
  const summary = String(merchantSummary || "").trim() || "A merchant";
  const title = "New merchant login";
  const text = `${summary} has logged in on the merchant app. Please review their documents and details and verify.`;
  return sendExpoToUsersByBroadcastMobiles(title, text, {
    type: "team_new_merchant_login",
    ...data,
  });
}

/**
 * Notify team (Expo) that a new customer (Karigar user app) registered — review and verify.
 *
 * @param {string} userLabel - name and/or mobile
 * @param {Record<string, unknown>} [data] - extra payload (e.g. userId)
 */
export async function notifyTeamNewUserRegisteredExpo(userLabel, data = {}) {
  const label = String(userLabel || "").trim() || "A user";
  const title = "New user registered";
  const text = `${label} has registered on the user app. Please review their details and verify.`;
  return sendExpoToUsersByBroadcastMobiles(title, text, {
    type: "team_new_user_registered",
    ...data,
  });
}
