import { Expo } from "expo-server-sdk";
import userModel from "../models/UserModel.js";
import { MerchentModel } from "../models/MerchentModel.js";
import { LaborModel } from "../models/laborModel.js";
import { ArchitectModel } from "../models/ArchitectModel.js";
import { getScheduledNotificationModel } from "../models/ScheduledNotificationModel.js";
import {
  computeNextScheduledFor,
  isRecurring,
} from "../utils/notificationRecurrence.js";
import { normalizeVersionOperator, versionMatches } from "../utils/semverCompare.js";

const expo = new Expo();
/** Expo `sendPushNotificationsAsync` rejects more than this many messages per call. */
const EXPO_PUSH_BATCH_MAX = 100;
let watcherTimer = null;
let watcherStream = null;
let busy = false;

function parseTestNotificationNumbers() {
  const raw =
    process.env.TEST_NOTIFICATION_NUMBERS ||
    process.env.TEAM_MEMBERS_NUMBERS ||
    "";
  return String(raw)
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function pushTokenQuery() {
  return {
    $or: [
      { pushToken: { $nin: [null, ""] } },
      { "pushTokens.0": { $exists: true } },
    ],
  };
}

function mergeTargetQuery(item, useMerchantVersionField = false) {
  const versionPlatform = buildFilterByVersionPlatform(item, useMerchantVersionField);
  return { ...pushTokenQuery(), ...versionPlatform };
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
  const version = String(item.version || "all").trim();
  const versionLower = version.toLowerCase();
  const platform = String(item.platform || "all")
    .trim()
    .toLowerCase();
  const op = normalizeVersionOperator(item.versionOperator || "eq");
  const versionField = useMerchantVersionField ? "app_version" : "version";

  // Exact match in Mongo; comparisons applied in memory after fetch.
  if (version && versionLower !== "all" && op === "eq") {
    filter[versionField] = version;
  }
  if (platform && platform !== "all") {
    filter.os = platform;
  }
  return filter;
}

function filterEntitiesByVersionOperator(entities, item, useMerchantVersionField = false) {
  const version = String(item.version || "all").trim();
  const versionLower = version.toLowerCase();
  if (!version || versionLower === "all") return entities;
  const op = normalizeVersionOperator(item.versionOperator || "eq");
  if (op === "eq") return entities;
  const versionField = useMerchantVersionField ? "app_version" : "version";
  return entities.filter((u) =>
    versionMatches(u?.[versionField] ?? u?.version, version, op)
  );
}

async function getTargetsForSchedule(item) {
  const isTest = !!item.isTest;

  if (isTest) {
    const numbers = parseTestNotificationNumbers();
    if (!numbers.length) return [];
    const users = await userModel
      .find({ mobile_number: { $in: numbers }, ...pushTokenQuery() })
      .select("pushToken pushTokens")
      .lean();
    return users.flatMap(collectExpoTokens);
  }

  const app = String(item.app || "").toLowerCase().trim();
  if (app === "users") {
    const users = await userModel
      .find(mergeTargetQuery(item))
      .select("pushToken pushTokens version os")
      .lean();
    return filterEntitiesByVersionOperator(users, item).flatMap(collectExpoTokens);
  }
  if (app === "merchants") {
    const merchants = await MerchentModel.find(mergeTargetQuery(item, true))
      .select("pushToken pushTokens app_version version os")
      .lean();
    return filterEntitiesByVersionOperator(merchants, item, true).flatMap(collectExpoTokens);
  }
  if (app === "worker") {
    const workers = await LaborModel.find(mergeTargetQuery(item))
      .select("pushToken pushTokens version os")
      .lean();
    return filterEntitiesByVersionOperator(workers, item).flatMap(collectExpoTokens);
  }
  if (app === "architect") {
    const architects = await ArchitectModel.find(mergeTargetQuery(item))
      .select("pushToken pushTokens version os")
      .lean();
    return filterEntitiesByVersionOperator(architects, item).flatMap(collectExpoTokens);
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
              `[scheduledNotificationsWatcher] test doc _id=${item?._id} detected; TEST_NOTIFICATION_NUMBERS=${JSON.stringify(
                numbers
              )}`
            );
            if (!numbers.length) return [];
            const users = await userModel
              .find({ mobile_number: { $in: numbers }, ...pushTokenQuery() })
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

function buildRecurrenceRequeueUpdate(item, resultOk, resultPayload, errorMessage) {
  const recurrence = item?.recurrence || {};
  const dispatch = {
    endpoint: "karigar-notifications watcher",
    dispatchedAt: new Date(),
    acknowledged: !!resultOk,
    response: resultPayload,
    error: errorMessage || null,
  };

  if (!isRecurring(item)) {
    return {
      status: resultOk ? "forwarded" : "failed",
      processedAt: new Date(),
      analyticsDispatch: dispatch,
    };
  }

  const hour = Number.isFinite(recurrence.hour)
    ? recurrence.hour
    : null;
  const minute = Number.isFinite(recurrence.minute)
    ? recurrence.minute
    : null;

  let nextFor;
  try {
    nextFor = computeNextScheduledFor({
      from: new Date(item.scheduledFor || Date.now()),
      frequency: recurrence.frequency,
      dayOfWeek: recurrence.dayOfWeek,
      dayOfMonth: recurrence.dayOfMonth,
      hour: hour ?? 9,
      minute: minute ?? 0,
      strictlyAfter: true,
    });
  } catch (err) {
    return {
      status: resultOk ? "forwarded" : "failed",
      processedAt: new Date(),
      analyticsDispatch: {
        ...dispatch,
        error:
          (errorMessage ? errorMessage + "; " : "") +
          (err?.message || "Failed to compute next recurrence"),
      },
    };
  }

  if (recurrence.endsAt && nextFor.getTime() > new Date(recurrence.endsAt).getTime()) {
    return {
      status: resultOk ? "forwarded" : "failed",
      processedAt: new Date(),
      analyticsDispatch: {
        ...dispatch,
        response: {
          ...(resultPayload && typeof resultPayload === "object" ? resultPayload : {}),
          recurrenceEnded: true,
          nextWouldHaveBeen: nextFor.toISOString(),
        },
      },
    };
  }

  return {
    status: "pending",
    scheduledFor: nextFor,
    processedAt: new Date(),
    processingAt: null,
    analyticsDispatch: {
      ...dispatch,
      response: {
        ...(resultPayload && typeof resultPayload === "object" ? resultPayload : {}),
        requeued: true,
        nextScheduledFor: nextFor.toISOString(),
      },
    },
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
    const $set = buildRecurrenceRequeueUpdate(
      item,
      !!result.ok,
      {
        message: result.message,
        tokenCount: result.tokenCount || 0,
        tickets: result.tickets || [],
      },
      result.ok ? null : result.message
    );
    if (isRecurring(item) && $set.status === "pending") {
      console.log(
        `[scheduledNotificationsWatcher] recurring doc _id=${item._id} re-queued for ${$set.scheduledFor?.toISOString?.() || $set.scheduledFor}`
      );
    }
    await Model.updateOne({ _id: item._id }, { $set });
  } catch (err) {
    const $set = buildRecurrenceRequeueUpdate(
      item,
      false,
      null,
      err?.message || "Watcher failed to send notification"
    );
    await Model.updateOne({ _id: item._id }, { $set });
  }
}

async function reclaimStuckProcessing(Model) {
  const staleMs = Math.max(
    60000,
    Number.parseInt(String(process.env.SCHEDULE_STALE_PROCESSING_MS || "300000"), 10) || 300000
  );
  const cutoff = new Date(Date.now() - staleMs);
  const result = await Model.updateMany(
    {
      status: "processing",
      $or: [{ processingAt: { $lte: cutoff } }, { processingAt: null }, { processingAt: { $exists: false } }],
      updatedAt: { $lte: cutoff },
    },
    { $set: { status: "pending", processingAt: null } }
  );
  if (result?.modifiedCount) {
    console.warn(
      `[scheduledNotificationsWatcher] reclaimed ${result.modifiedCount} stuck processing schedule(s)`
    );
  }
}

async function tick() {
  if (busy) return;
  busy = true;
  try {
    const Model = getScheduledNotificationModel();
    const now = new Date();
    await reclaimStuckProcessing(Model);
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

