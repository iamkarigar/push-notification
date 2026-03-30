import mongoose from "mongoose";

function toBool(val, defaultValue = false) {
  if (val == null) return defaultValue;
  const s = String(val).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return defaultValue;
}

function buildBaseUrl(port) {
  const env = String(process.env.NOTIFICATIONS_BASE_URL || "").trim();
  if (env) return env.replace(/\/+$/, "");
  return `http://localhost:${port}`;
}

/**
 * Watches the `temp_orders` collection (OrderInitiateModel) and triggers
 * POST /api/v1/notifications/order-initiate-notify-team for every insert.
 *
 * Requires MongoDB replica set (change streams).
 */
export function startOrderInitiateWatcher({ port }) {
  const enabled = toBool(process.env.ENABLE_ORDER_INITIATE_WATCHER, false);
  // if (!enabled) {
  //   console.log("[order-initiate-watcher] disabled (set ENABLE_ORDER_INITIATE_WATCHER=true)");
  //   return { stop: async () => {} };
  // }

  const baseUrl = buildBaseUrl(port);
  const endpoint = `${baseUrl}/api/v1/notifications/order-initiate-notify-team`;
  const processed = new Map(); // orderId -> ts
  const dedupeMs = Number(process.env.ORDER_INITIATE_WATCH_DEDUPE_MS || 5 * 60 * 1000);

  function seenRecently(orderId) {
    const now = Date.now();
    for (const [k, ts] of processed) {
      if (now - ts > dedupeMs) processed.delete(k);
    }
    const last = processed.get(orderId);
    if (last && now - last < dedupeMs) return true;
    processed.set(orderId, now);
    return false;
  }

  const collection = mongoose.connection.collection("temp_orders");
  const pipeline = [{ $match: { operationType: "insert" } }];

  let changeStream = null;
  let stopped = false;

  async function open() {
    if (stopped) return;
    try {
      changeStream = collection.watch(pipeline, { fullDocument: "default" });
      console.log("[order-initiate-watcher] watching temp_orders inserts");

      changeStream.on("change", async (event) => {
        try {
          const doc = event?.fullDocument || {};
          const orderId = doc.orderId || doc.order_id || doc.paymentId;
          if (!orderId) return;
          const id = String(orderId).trim();
          if (!id) return;
          if (seenRecently(id)) return;

          const resp = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: id }),
          });
          const json = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            console.error(
              "[order-initiate-watcher] notify failed",
              resp.status,
              json?.message || json?.error || json
            );
          }
        } catch (err) {
          console.error("[order-initiate-watcher] change handler error:", err?.message || err);
        }
      });

      changeStream.on("error", (err) => {
        console.error("[order-initiate-watcher] stream error:", err?.message || err);
        try {
          changeStream?.close();
        } catch (_) {}
        changeStream = null;
        setTimeout(open, 2000);
      });

      changeStream.on("close", () => {
        if (stopped) return;
        console.warn("[order-initiate-watcher] stream closed; reopening");
        changeStream = null;
        setTimeout(open, 2000);
      });
    } catch (err) {
      console.error("[order-initiate-watcher] failed to start:", err?.message || err);
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

