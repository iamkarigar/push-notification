import MaterialOrderModel from "../../models/MaterialOrderModel.js";
import { OrderInitiateModel } from "../../models/OrderInitiateModel.js";
import { MerchentModel } from "../../models/MerchentModel.js";
import {
  notifyTeamNewOrderReceivedExpo,
  notifyTeamOrderInitiatedExpo,
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

/**
 * POST /api/v1/notifications/order-initiate-notify-team
 *
 * Body (one of):
 * - { "order_id" } or { "orderId" } — loads from temp_orders (OrderInitiateModel)
 * - { "material_name", "amount" } — direct payload
 *
 * Optional:
 * - data: object merged in Expo payload
 */
export async function notifyTeamOrderInitiateHandler(req, res) {
  try {
    const body = req.body || {};
    const {
      order_id,
      orderId,
      material_name,
      materialName,
      amount,
      data: extraData,
    } = body;

    const lookupOrderId = order_id || orderId;
    let resolvedMaterial = null;
    let resolvedAmount = null;
    let resolvedUserId = null;

    if (lookupOrderId) {
      const order = await OrderInitiateModel.findOne({
        $or: [{ orderId: lookupOrderId }, { order_id: lookupOrderId }],
      })
        .select("orderId order_id userId totalAmount subtotal items")
        .lean();

      if (!order) {
        return res.status(404).json({ success: false, message: "Initiated order not found" });
      }

      resolvedUserId = order.userId ? String(order.userId) : null;
      const firstItemName = Array.isArray(order.items) ? order.items[0]?.productName : null;
      const itemCount = Array.isArray(order.items) ? order.items.length : 0;
      if (firstItemName && String(firstItemName).trim()) {
        resolvedMaterial =
          itemCount > 1
            ? `${String(firstItemName).trim()} + ${itemCount - 1} more`
            : String(firstItemName).trim();
      } else {
        resolvedMaterial = "material";
      }
      const amountValue =
        order.totalAmount != null && Number.isFinite(Number(order.totalAmount))
          ? Number(order.totalAmount)
          : Number.isFinite(Number(order.subtotal))
            ? Number(order.subtotal)
            : null;
      resolvedAmount = amountValue != null ? `Rs ${amountValue}` : null;
    } else {
      const directMaterial = material_name ?? materialName;
      resolvedMaterial =
        directMaterial != null && String(directMaterial).trim()
          ? String(directMaterial).trim()
          : null;
      resolvedAmount = amount != null && String(amount).trim() ? String(amount).trim() : null;
    }

    if (!resolvedMaterial || !resolvedAmount) {
      return res.status(400).json({
        success: false,
        message: "Provide order_id/orderId or material_name/materialName with amount",
      });
    }

    const pushData = {
      ...(typeof extraData === "object" && extraData !== null ? extraData : {}),
    };
    if (lookupOrderId) pushData.orderId = lookupOrderId;
    if (resolvedUserId) pushData.userId = resolvedUserId;

    const result = await notifyTeamOrderInitiatedExpo(resolvedMaterial, resolvedAmount, pushData);
    const status = result.success ? 200 : 400;
    return res.status(status).json({
      success: result.success,
      message: result.success ? "Team notified" : result.error || result.message || "Failed",
      teamPush: result,
    });
  } catch (error) {
    console.error("notifyTeamOrderInitiateHandler:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
}
