/**
 * Team notification “basic” functions — same behaviour as the matching HTTP routes under
 * `/api/v1/notifications/*`, but plain async functions (no Express `req`/`res`).
 *
 * Use from change streams, cron, scripts, or tests. Routes should delegate here so logic stays
 * in one place.
 */

import userModel from "../models/UserModel.js";
import { LaborModel } from "../models/laborModel.js";
import { MerchentModel } from "../models/MerchentModel.js";
import MaterialOrderModel from "../models/MaterialOrderModel.js";
import { OrderInitiateModel } from "../models/OrderInitiateModel.js";
import {
  notifyTeamNewOrderReceivedExpo,
  notifyTeamOrderInitiatedExpo,
  notifyTeamSimpleNewOrderExpo,
  notifyTeamNewLabourRegisteredExpo,
  notifyTeamNewMerchantLoggedInExpo,
  notifyTeamNewUserRegisteredExpo,
} from "./broadcastTeamPushByMobile.js";
import { runNotifyLaboursForNewJobRequirement } from "../controllers/labourJobsNotifications/immidiate.js";

function buildMerchantSummary(m) {
  const business = m.buisnessName || m.name || "Merchant";
  const name = m.name && m.name !== business ? m.name : null;
  const mobile = m.mobile_number ? String(m.mobile_number).trim() : null;
  const city = m.buisnessAddress?.city ? String(m.buisnessAddress.city).trim() : null;
  const parts = [business];
  if (name) parts.push(name);
  if (mobile) parts.push(mobile);
  if (city) parts.push(city);
  return parts.join(" · ");
}

/**
 * Same as POST `/api/v1/notifications/user-registered-notify-team`.
 * @param {object} body - same shape as route body (`user_id` or `name` / `mobile_number`, optional `data`)
 * @returns {Promise<{ status: number, json: object }>}
 */
export async function notifyTeamUserRegisteredBasic(body = {}) {
  try {
    const { user_id, name, mobile_number, data: extraData } = body;

    let displayLabel = null;
    let userIdForPayload = null;

    if (user_id) {
      const user = await userModel.findById(user_id).select("name mobile_number").lean();
      if (!user) {
        return { status: 404, json: { success: false, message: "User not found" } };
      }
      userIdForPayload = String(user._id);
      const parts = [user.name, user.mobile_number].filter((x) => x != null && String(x).trim());
      displayLabel = parts.length ? parts.join(" · ") : "A user";
    } else {
      const n = name != null && String(name).trim() ? String(name).trim() : null;
      const m = mobile_number != null && String(mobile_number).trim() ? String(mobile_number).trim() : null;
      if (!n && !m) {
        return {
          status: 400,
          json: { success: false, message: "Provide user_id, or name / mobile_number" },
        };
      }
      displayLabel = [n, m].filter(Boolean).join(" · ");
    }

    const pushData = {
      ...(typeof extraData === "object" && extraData !== null ? extraData : {}),
    };
    if (userIdForPayload) pushData.userId = userIdForPayload;

    const result = await notifyTeamNewUserRegisteredExpo(displayLabel, pushData);
    const status = result.success ? 200 : 400;
    return {
      status,
      json: {
        success: result.success,
        message: result.success ? "Team notified" : result.error || result.message || "Failed",
        teamPush: result,
      },
    };
  } catch (error) {
    console.error("notifyTeamUserRegisteredBasic:", error);
    return { status: 500, json: { success: false, message: error.message || "Server error" } };
  }
}

/**
 * Same as POST `/api/v1/notifications/labour-registered-notify-team`.
 */
export async function notifyTeamLabourRegisteredBasic(body = {}) {
  try {
    const { labour_id, labor_id, name, mobile_number, data: extraData } = body;
    const id = labour_id || labor_id;

    let displayLabel = null;
    let labourIdForPayload = null;

    if (id) {
      const labour = await LaborModel.findById(id).select("name mobile_number").lean();
      if (!labour) {
        return { status: 404, json: { success: false, message: "Labour not found" } };
      }
      labourIdForPayload = String(labour._id);
      const parts = [labour.name, labour.mobile_number].filter((x) => x != null && String(x).trim());
      displayLabel = parts.length ? parts.join(" · ") : "A worker";
    } else {
      const n = name != null && String(name).trim() ? String(name).trim() : null;
      const m = mobile_number != null && String(mobile_number).trim() ? String(mobile_number).trim() : null;
      if (!n && !m) {
        return {
          status: 400,
          json: {
            success: false,
            message: "Provide labour_id (or labor_id), or name / mobile_number",
          },
        };
      }
      displayLabel = [n, m].filter(Boolean).join(" · ");
    }

    const pushData = {
      ...(typeof extraData === "object" && extraData !== null ? extraData : {}),
    };
    if (labourIdForPayload) pushData.labourId = labourIdForPayload;

    const result = await notifyTeamNewLabourRegisteredExpo(displayLabel, pushData);
    const status = result.success ? 200 : 400;
    return {
      status,
      json: {
        success: result.success,
        message: result.success ? "Team notified" : result.error || result.message || "Failed",
        teamPush: result,
      },
    };
  } catch (error) {
    console.error("notifyTeamLabourRegisteredBasic:", error);
    return { status: 500, json: { success: false, message: error.message || "Server error" } };
  }
}

/**
 * Same as POST `/api/v1/notifications/merchant-login-notify-team`.
 */
export async function notifyTeamMerchantLoginBasic(body = {}) {
  try {
    const {
      merchant_id,
      business_name,
      buisnessName,
      name,
      mobile_number,
      data: extraData,
    } = body;

    let displaySummary = null;
    let pushData = {};

    if (merchant_id) {
      const merchant = await MerchentModel.findById(merchant_id)
        .select("name mobile_number buisnessName buisnessAddress is_verified profileImage document")
        .lean();

      if (!merchant) {
        return { status: 404, json: { success: false, message: "Merchant not found" } };
      }

      displaySummary = buildMerchantSummary(merchant);
      pushData = {
        merchantId: String(merchant._id),
        businessName: merchant.buisnessName ?? null,
        contactName: merchant.name ?? null,
        mobile_number: merchant.mobile_number ?? null,
        is_verified: merchant.is_verified === true,
        city: merchant.buisnessAddress?.city ?? null,
        addressLine: merchant.buisnessAddress?.addressLine ?? null,
        documentCount: Array.isArray(merchant.document) ? merchant.document.length : 0,
        ...(typeof extraData === "object" && extraData !== null ? extraData : {}),
      };
    } else {
      const biz = business_name || buisnessName;
      const n = name != null && String(name).trim() ? String(name).trim() : null;
      const m = mobile_number != null && String(mobile_number).trim() ? String(mobile_number).trim() : null;

      if (!biz && !n && !m) {
        return {
          status: 400,
          json: {
            success: false,
            message: "Provide merchant_id, or business_name / name / mobile_number",
          },
        };
      }

      const parts = [];
      if (biz) parts.push(String(biz).trim());
      if (n) parts.push(n);
      if (m) parts.push(m);
      displaySummary = parts.join(" · ");
      pushData = {
        ...(typeof extraData === "object" && extraData !== null ? extraData : {}),
      };
    }

    const result = await notifyTeamNewMerchantLoggedInExpo(displaySummary, pushData);
    const status = result.success ? 200 : 400;
    return {
      status,
      json: {
        success: result.success,
        message: result.success ? "Team notified" : result.error || result.message || "Failed",
        teamPush: result,
      },
    };
  } catch (error) {
    console.error("notifyTeamMerchantLoginBasic:", error);
    return { status: 500, json: { success: false, message: error.message || "Server error" } };
  }
}

/**
 * Same as POST `/api/v1/notifications/new-order-notify-team`.
 */
export async function notifyTeamNewOrderBasic(body = {}) {
  try {
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
        return { status: 404, json: { success: false, message: "Order not found" } };
      }
      const merchantId = orderDoc.merchantId;
      if (!merchantId) {
        return { status: 400, json: { success: false, message: "No merchant on order" } };
      }
      const merchant = await MerchentModel.findById(merchantId).lean();
      if (!merchant) {
        return { status: 404, json: { success: false, message: "Merchant not found" } };
      }
      if (!displayName) {
        displayName =
          merchant.buisnessName || merchant.name || orderDoc.merchantName || "Merchant";
      }
    }

    if (!displayName || !String(displayName).trim()) {
      return {
        status: 400,
        json: {
          success: false,
          message: "Provide order_id or merchant_name / received_by / business_name",
        },
      };
    }

    const pushData = {
      ...(typeof extraData === "object" && extraData !== null ? extraData : {}),
    };
    if (order_id) pushData.orderId = order_id;

    const result = await notifyTeamNewOrderReceivedExpo(String(displayName).trim(), pushData);
    const status = result.success ? 200 : 400;
    return {
      status,
      json: {
        success: result.success,
        message: result.success ? "Team notified" : result.error || result.message || "Failed",
        teamPush: result,
      },
    };
  } catch (error) {
    console.error("notifyTeamNewOrderBasic:", error);
    return { status: 500, json: { success: false, message: error.message || "Server error" } };
  }
}

/**
 * Same as POST `/api/v1/notifications/new-order-simple-notify-team`.
 */
export async function notifyTeamSimpleNewOrderBasic() {
  try {
    const result = await notifyTeamSimpleNewOrderExpo();
    const status = result.success ? 200 : 400;
    return {
      status,
      json: {
        success: result.success,
        message: result.success ? "Team notified" : result.error || result.message || "Failed",
        teamPush: result,
      },
    };
  } catch (error) {
    console.error("notifyTeamSimpleNewOrderBasic:", error);
    return { status: 500, json: { success: false, message: error.message || "Server error" } };
  }
}

/**
 * Same as POST `/api/v1/notifications/order-initiate-notify-team`.
 */
export async function notifyTeamOrderInitiateBasic(body = {}) {
  try {
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
        return { status: 404, json: { success: false, message: "Initiated order not found" } };
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
      return {
        status: 400,
        json: {
          success: false,
          message: "Provide order_id/orderId or material_name/materialName with amount",
        },
      };
    }

    const pushData = {
      ...(typeof extraData === "object" && extraData !== null ? extraData : {}),
    };
    if (lookupOrderId) pushData.orderId = lookupOrderId;
    if (resolvedUserId) pushData.userId = resolvedUserId;

    const result = await notifyTeamOrderInitiatedExpo(resolvedMaterial, resolvedAmount, pushData);
    const status = result.success ? 200 : 400;
    return {
      status,
      json: {
        success: result.success,
        message: result.success ? "Team notified" : result.error || result.message || "Failed",
        teamPush: result,
      },
    };
  } catch (error) {
    console.error("notifyTeamOrderInitiateBasic:", error);
    return { status: 500, json: { success: false, message: error.message || "Server error" } };
  }
}

/**
 * Same as POST `/api/v1/notifications/job-requirement-notify-labours` (body `{ jobId }`).
 */
export async function notifyLaboursForNewJobRequirementBasic(jobId) {
  return runNotifyLaboursForNewJobRequirement(jobId);
}
