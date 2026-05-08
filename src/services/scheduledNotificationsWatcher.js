import { Expo } from "expo-server-sdk";
import userModel from "../models/UserModel.js";
import { MerchentModel } from "../models/MerchentModel.js";
import { LaborModel } from "../models/laborModel.js";
import { ArchitectModel } from "../models/ArchitectModel.js";
import { getScheduledNotificationModel } from "../models/ScheduledNotificationModel.js";

const expo = new Expo();
/** Expo `sendPushNotificationsAsync` rejects more than this many messages per call. */
const EXPO_PUSH_BATCH_MAX = 100;
let watcherTimer = null;
let watcherStream = null;
let busy = false;

function parseTestNotificationNumbers() {
  return String(process.env.TEST_NOTIFICATION_NUMBERS || "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function collectExpoTokens(entity) {
  const set = new Set();
  const single = entity?.pushToken != null ? String(entity.pushToken).trim() : "";
  if (single && Expo.isExpoPushToken(single)) set.add(single);
  if (Array.isArray(entity?.pushTokens)) {
    for (const t of entity.pushTokens) {
      const s = t != null ? String(t).trim() : "";
      if (s && Expo.isExpoPushToken(s)) set.add(s);
    }
  }
  return [...set];
}

function buildFilterByVersionPlatform(item, useMerchantVersionField = false) {
  const filter = {};
  const version = String(item.version || "all")
    .trim()
    .toLowerCase();
  const platform = String(item.platform || "all")
    .trim()
    .toLowerCase();

  if (version && version !== "all") {
    filter[useMerchantVersionField ? "app_version" : "version"] = version;
  }
  if (platform && platform !== "all") {
    filter.os = platform;
  }
  return filter;
}

async function getTargetsForSchedule(item) {
  const isTest = !!item.isTest;

  if (isTest) {
    const numbers = parseTestNotificationNumbers();
    if (!numbers.length) return [];
    const users = await userModel
      .find({ mobile_number: { $in: numbers } })
      .select("pushToken pushTokens")
      .lean();
    return users.flatMap(collectExpoTokens);
  }

  const app = String(item.app || "").toLowerCase().trim();
  if (app === "users") {
    const users = await userModel
      .find(buildFilterByVersionPlatform(item))
      .select("pushToken pushTokens")
      .lean();
    return users.flatMap(collectExpoTokens);
  }
  if (app === "merchants") {
    const merchants = await MerchentModel.find(buildFilterByVersionPlatform(item, true))
      .select("pushToken pushTokens")
      .lean();
    return merchants.flatMap(collectExpoTokens);
  }
  if (app === "worker") {
    // Worker collection does not consistently carry version/os in every environment.
    const workers = await LaborModel.find({})
      .select("pushToken pushTokens")
      .lean();
    return workers.flatMap(collectExpoTokens);
  }
  if (app === "architect") {
    const architects = await ArchitectModel.find(buildFilterByVersionPlatform(item))
      .select("pushToken pushTokens")
      .lean();
    return architects.flatMap(collectExpoTokens);
  }
  return [];
}

async function sendScheduledNotification(item) {
  // For test schedules, always resolve recipients from userModel only.
  const tokens = item?.isTest
    ? [
        ...new Set(
          await (async () => {
            const numbers = parseTestNotificationNumbers();
            console.log(
              `[scheduledNotificationsWatcher] test doc _id=${item?._id} detected; TEAM_MEMBERS_NUMBERS=${JSON.stringify(
                numbers
              )}`
            );
            if (!numbers.length) return [];
            const users = await userModel
              .find({ mobile_number: { $in: numbers } })
              .select("pushToken pushTokens")
              .lean();
            const testTokens = users.flatMap(collectExpoTokens);
            console.log(
              `[scheduledNotificationsWatcher] test doc _id=${item?._id} resolved tokens=${JSON.stringify(
                testTokens
              )}`
            );
            return testTokens;
          })()
        ),
      ]
    : [...new Set(await getTargetsForSchedule(item))];
  if (!tokens.length) {
    return {
      ok: false,
      message: "No valid Expo tokens found for the schedule target.",
      tickets: [],
    };
  }
  const title = String(item.title || "").trim();
  const description = String(item.description || "").trim();
  const payloadData =
    item.data && typeof item.data === "object" && !Array.isArray(item.data) ? item.data : {};

  const messages = tokens.map((to) => ({
    to,
    title,
    body: description,
    data: payloadData,
    channelId: "custom-sound-channel",
    sound: item.app === "worker" ? "ring_phone.wav" : "normal_notification.wav",
    priority: "high",
    _contentAvailable: true,
  }));

  const tickets = [];
  for (let i = 0; i < messages.length; i += EXPO_PUSH_BATCH_MAX) {
    const chunk = messages.slice(i, i + EXPO_PUSH_BATCH_MAX);
    const batchTickets = await expo.sendPushNotificationsAsync(chunk);
    tickets.push(...batchTickets);
  }
  const hasErrorTicket = tickets.some((t) => t?.status === "error");
  return {
    ok: !hasErrorTicket,
    message: hasErrorTicket ? "Some Expo tickets failed." : "Notification sent via Expo.",
    tickets,
    tokenCount: tokens.length,
  };
}

async function processOne(item, Model) {
  const lock = await Model.findOneAndUpdate(
    { _id: item._id, status: "pending" },
    { $set: { status: "processing", processingAt: new Date() } },
    { new: true }
  );
  if (!lock?._id) return;

  try {
    const result = await sendScheduledNotification(item);
    await Model.updateOne(
      { _id: item._id },
      {
        $set: {
          status: result.ok ? "forwarded" : "failed",
          processedAt: new Date(),
          analyticsDispatch: {
            endpoint: "karigar-notifications watcher",
            dispatchedAt: new Date(),
            acknowledged: !!result.ok,
            response: {
              message: result.message,
              tokenCount: result.tokenCount || 0,
              tickets: result.tickets || [],
            },
            error: result.ok ? null : result.message,
          },
        },
      }
    );
  } catch (err) {
    await Model.updateOne(
      { _id: item._id },
      {
        $set: {
          status: "failed",
          processedAt: new Date(),
          analyticsDispatch: {
            endpoint: "karigar-notifications watcher",
            dispatchedAt: new Date(),
            acknowledged: false,
            response: null,
            error: err?.message || "Watcher failed to send notification",
          },
        },
      }
    );
  }
}

async function tick() {
  if (busy) return;
  busy = true;
  try {
    const Model = getScheduledNotificationModel();
    const now = new Date();
    const due = await Model.find({
        status: "pending",
        scheduledFor: { $lte: now },
      })
      .sort({ scheduledFor: 1, createdAt: 1 })
      .limit(30)
      .lean();

    if (due.length) {
      console.log(`[scheduledNotificationsWatcher] found ${due.length} due schedule(s)`);
    }

    for (const item of due) {
      console.log(
        `[scheduledNotificationsWatcher] due doc _id=${item._id} app=${item.app} scheduledFor=${item.scheduledFor} status=${item.status}`
      );
      await processOne(item, Model);
    }
  } catch (err) {
    console.error("[scheduledNotificationsWatcher]", err?.message || err);
  } finally {
    busy = false;
  }
}

function isDueNow(item) {
  const when = new Date(item?.scheduledFor || 0);
  return Number.isFinite(when.getTime()) && when.getTime() <= Date.now();
}

function startInstantInsertWatcher(Model) {
  if (watcherStream) return;
  try {
    watcherStream = Model.collection.watch([{ $match: { operationType: "insert" } }], {
      fullDocument: "default",
    });
    watcherStream.on("change", async (event) => {
      try {
        const doc = event?.fullDocument;
        if (!doc?._id) return;
        if (String(doc.status || "").toLowerCase() !== "pending") return;
        if (!isDueNow(doc)) return;
        console.log(
          `[scheduledNotificationsWatcher] instant due doc detected _id=${doc._id}; processing now`
        );
        await processOne(doc, Model);
      } catch (err) {
        console.error("[scheduledNotificationsWatcher] instant change handler:", err?.message || err);
      }
    });
    watcherStream.on("error", (err) => {
      console.error("[scheduledNotificationsWatcher] stream error:", err?.message || err);
    });
    watcherStream.on("close", () => {
      watcherStream = null;
      console.warn("[scheduledNotificationsWatcher] stream closed");
    });
    console.log("[scheduledNotificationsWatcher] instant insert watcher started");
  } catch (err) {
    console.error("[scheduledNotificationsWatcher] failed to start instant watcher:", err?.message || err);
    watcherStream = null;
  }
}

export function startScheduledNotificationsWatcher() {
  if (watcherTimer) return;
  const Model = getScheduledNotificationModel();
  const everyMs = Math.max(
    5000,
    Number.parseInt(String(process.env.SCHEDULE_WATCH_INTERVAL_MS || "15000"), 10) || 15000
  );
  watcherTimer = setInterval(() => {
    tick();
  }, everyMs);
  startInstantInsertWatcher(Model);
  tick();
  console.log(`[scheduledNotificationsWatcher] started. interval=${everyMs}ms`);
}

