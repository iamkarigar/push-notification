import mongoose from "mongoose";
import userModel from "../models/UserModel.js";
import { LaborModel } from "../models/laborModel.js";
import { MerchentModel } from "../models/MerchentModel.js";
import MaterialOrderModel from "../models/MaterialOrderModel.js";
import { LabourRequirementModel } from "../models/labourRequirementModel.js";
import {
  notifyTeamUserRegisteredBasic,
  notifyTeamLabourRegisteredBasic,
  notifyTeamMerchantLoginBasic,
  notifyTeamNewOrderBasic,
  notifyTeamOrderInitiateBasic,
  notifyLaboursForNewJobRequirementBasic,
} from "../services/teamNotificationBasicFunctions.js";

function toBool(val, defaultValue = false) {
  if (val == null) return defaultValue;
  const s = String(val).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return defaultValue;
}

function createDeduper(defaultMs) {
  const processed = new Map();
  const dedupeMs = Number(process.env.TEAM_WATCH_DEDUPE_MS || defaultMs);

  return function seenRecently(key) {
    const now = Date.now();
    for (const [k, ts] of processed) {
      if (now - ts > dedupeMs) processed.delete(k);
    }
    const last = processed.get(key);
    if (last && now - last < dedupeMs) return true;
    processed.set(key, now);
    return false;
  };
}

/**
 * @param {object} opts
 * @param {string} opts.logPrefix
 * @param {import('mongodb').Collection} opts.collection
 * @param {(doc: object) => Promise<void>} opts.onInsert
 * @param {(doc: object) => string} opts.getDedupeKey
 * @param {boolean} opts.enabled
 */
function startInsertWatcher({ logPrefix, collection, onInsert, getDedupeKey, enabled }) {
  if (!enabled) {
    console.log(`${logPrefix} disabled`);
    return { stop: async () => {} };
  }

  const seenRecently = createDeduper(5 * 60 * 1000);
  const pipeline = [{ $match: { operationType: "insert" } }];
  let changeStream = null;
  let stopped = false;

  async function open() {
    if (stopped) return;
    try {
      changeStream = collection.watch(pipeline, { fullDocument: "default" });
      console.log(`${logPrefix} watching inserts on ${collection.collectionName}`);

      changeStream.on("change", async (event) => {
        try {
          const doc = event?.fullDocument;
          if (!doc) return;
          const key = getDedupeKey(doc);
          if (!key || seenRecently(key)) return;
          await onInsert(doc);
        } catch (err) {
          console.error(`${logPrefix} change handler error:`, err?.message || err);
        }
      });

      changeStream.on("error", (err) => {
        console.error(`${logPrefix} stream error:`, err?.message || err);
        try {
          changeStream?.close();
        } catch (_) {}
        changeStream = null;
        setTimeout(open, 2000);
      });

      changeStream.on("close", () => {
        if (stopped) return;
        console.warn(`${logPrefix} stream closed; reopening`);
        changeStream = null;
        setTimeout(open, 2000);
      });
    } catch (err) {
      console.error(`${logPrefix} failed to start:`, err?.message || err);
      setTimeout(open, 3000);
    }
  }

  open();

  return {
    stop: async () => {
      stopped = true;
      try {
        await changeStream?.close();
      } catch (_) {}
    },
  };
}

function logFailed(prefix, out) {
  if (out.json?.success) return;
  console.error(prefix, out.status, out.json?.message || out.json);
}

function masterEnabled() {
  return toBool(process.env.ENABLE_TEAM_COLLECTION_WATCHERS, true);
}

function whenSub(name, defaultTrue = true) {
  if (!masterEnabled()) return false;
  return toBool(process.env[name], defaultTrue);
}

/**
 * MongoDB change streams (replica set) on app collections → same logic as notification APIs via
 * `teamNotificationBasicFunctions.js` (no internal HTTP).
 *
 * `ENABLE_TEAM_COLLECTION_WATCHERS` defaults to **true** (set to `false` to disable all watchers).
 * Optional per-stream toggles (default true when master is on):
 * `ENABLE_TEAM_WATCH_USERS`, `ENABLE_TEAM_WATCH_LABOURS`, `ENABLE_TEAM_WATCH_MERCHANTS`,
 * `ENABLE_TEAM_WATCH_MATERIAL_ORDERS`, `ENABLE_TEAM_WATCH_JOB_REQUIREMENTS`, `ENABLE_TEAM_WATCH_ORDER_INITIATE`.
 */
export function startTeamCollectionWatchers() {
  const stoppers = [];

  const runUsers = whenSub("ENABLE_TEAM_WATCH_USERS", true);
  const runLabours = whenSub("ENABLE_TEAM_WATCH_LABOURS", true);
  const runMerchants = whenSub("ENABLE_TEAM_WATCH_MERCHANTS", true);
  const runMaterials = whenSub("ENABLE_TEAM_WATCH_MATERIAL_ORDERS", true);
  const runJobs = whenSub("ENABLE_TEAM_WATCH_JOB_REQUIREMENTS", true);
  const runOrderInitiate = whenSub("ENABLE_TEAM_WATCH_ORDER_INITIATE", true);

  if (!runUsers && !runLabours && !runMerchants && !runMaterials && !runJobs && !runOrderInitiate) {
    console.log(
      "[team-collection-watchers] all disabled (ENABLE_TEAM_COLLECTION_WATCHERS=false or every sub-flag false)"
    );
    return { stop: async () => {} };
  }

  if (runUsers) {
    stoppers.push(
      startInsertWatcher({
        logPrefix: "[team-watch-users]",
        collection: userModel.collection,
        getDedupeKey: (doc) => String(doc._id),
        onInsert: async (doc) => {
          const out = await notifyTeamUserRegisteredBasic({ user_id: String(doc._id) });
          logFailed("[team-watch-users]", out);
        },
        enabled: true,
      })
    );
  }

  if (runLabours) {
    stoppers.push(
      startInsertWatcher({
        logPrefix: "[team-watch-labours]",
        collection: LaborModel.collection,
        getDedupeKey: (doc) => String(doc._id),
        onInsert: async (doc) => {
          const out = await notifyTeamLabourRegisteredBasic({ labour_id: String(doc._id) });
          logFailed("[team-watch-labours]", out);
        },
        enabled: true,
      })
    );
  }

  if (runMerchants) {
    stoppers.push(
      startInsertWatcher({
        logPrefix: "[team-watch-merchants]",
        collection: MerchentModel.collection,
        getDedupeKey: (doc) => String(doc._id),
        onInsert: async (doc) => {
          const out = await notifyTeamMerchantLoginBasic({ merchant_id: String(doc._id) });
          logFailed("[team-watch-merchants]", out);
        },
        enabled: true,
      })
    );
  }

  if (runMaterials) {
    stoppers.push(
      startInsertWatcher({
        logPrefix: "[team-watch-material-orders]",
        collection: MaterialOrderModel.collection,
        getDedupeKey: (doc) => String(doc._id),
        onInsert: async (doc) => {
          const out = await notifyTeamNewOrderBasic({ order_id: String(doc._id) });
          logFailed("[team-watch-material-orders]", out);
        },
        enabled: true,
      })
    );
  }

  if (runJobs) {
    stoppers.push(
      startInsertWatcher({
        logPrefix: "[team-watch-job-requirements]",
        collection: LabourRequirementModel.collection,
        getDedupeKey: (doc) => String(doc._id),
        onInsert: async (doc) => {
          const out = await notifyLaboursForNewJobRequirementBasic(String(doc._id));
          logFailed("[team-watch-job-requirements]", out);
        },
        enabled: true,
      })
    );
  }

  if (runOrderInitiate) {
    stoppers.push(
      startInsertWatcher({
        logPrefix: "[team-watch-order-initiate]",
        collection: mongoose.connection.collection("temp_orders"),
        getDedupeKey: (doc) => {
          const orderId = doc.orderId || doc.order_id || doc.paymentId;
          return orderId ? String(orderId).trim() : "";
        },
        onInsert: async (doc) => {
          const orderId = doc.orderId || doc.order_id || doc.paymentId;
          if (!orderId) return;
          const out = await notifyTeamOrderInitiateBasic({ orderId: String(orderId).trim() });
          logFailed("[team-watch-order-initiate]", out);
        },
        enabled: true,
      })
    );
  }

  return {
    stop: async () => {
      for (const s of stoppers) {
        await s.stop();
      }
    },
  };
}
