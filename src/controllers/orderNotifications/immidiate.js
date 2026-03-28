import MaterialOrderModel from "../../models/MaterialOrderModel.js";
import { MerchentModel } from "../../models/MerchentModel.js";
import {
  notifyTeamNewOrderReceivedExpo,
  notifyTeamSimpleNewOrderExpo,
} from "../../services/broadcastTeamPushByMobile.js";

/**
 * POST body (one of):
 * - { "order_id" } — loads merchant from order and uses business / name as XYZ
 * - { "merchant_name" } or { "received_by" } or { "business_name" } — explicit XYZ
 *
 * Optional: any extra fields passed through in push `data` (e.g. productName) via `data` key in body.
 */
export async function notifyTeamNewOrderHandler(req, res) {
  try {
    const body = req.body || {};
    const { order_id, merchant_name, received_by, business_name, data: extraData } = body;

    let displayName = null;
    for (const v of [merchant_name, received_by, business_name]) {
      if (v != null && String(v).trim()) {
        displayName = String(v).trim();
        break;
      }
    }

    if (order_id) {
      const orderDoc = await MaterialOrderModel.findById(order_id).lean();
      if (!orderDoc) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }
      const merchantId = orderDoc.merchantId;
      if (!merchantId) {
        return res.status(400).json({ success: false, message: "No merchant on order" });
      }
      const merchant = await MerchentModel.findById(merchantId).lean();
      if (!merchant) {
        return res.status(404).json({ success: false, message: "Merchant not found" });
      }
      if (!displayName) {
        displayName =
          merchant.buisnessName || merchant.name || orderDoc.merchantName || "Merchant";
      }
    }

    if (!displayName || !String(displayName).trim()) {
      return res.status(400).json({
        success: false,
        message: "Provide order_id or merchant_name / received_by / business_name",
      });
    }

    const pushData = {
      ...(typeof extraData === "object" && extraData !== null ? extraData : {}),
    };
    if (order_id) pushData.orderId = order_id;

    const result = await notifyTeamNewOrderReceivedExpo(String(displayName).trim(), pushData);

    const status = result.success ? 200 : 400;
    return res.status(status).json({
      success: result.success,
      message: result.success ? "Team notified" : result.error || result.message || "Failed",
      teamPush: result,
    });
  } catch (error) {
    console.error("notifyTeamNewOrderHandler:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
}

/**
 * POST — no body required. Sends a generic “new order” Expo to team (`TEAM_EXPO_NOTIFY_MOBILE_NUMBERS`).
 */
export async function notifyTeamSimpleNewOrderHandler(req, res) {
  try {
    const result = await notifyTeamSimpleNewOrderExpo();
    const status = result.success ? 200 : 400;
    return res.status(status).json({
      success: result.success,
      message: result.success ? "Team notified" : result.error || result.message || "Failed",
      teamPush: result,
    });
  } catch (error) {
    console.error("notifyTeamSimpleNewOrderHandler:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
}
