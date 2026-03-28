import { MerchentModel } from "../../models/MerchentModel.js";
import { notifyTeamNewMerchantLoggedInExpo } from "../../services/broadcastTeamPushByMobile.js";

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
 * POST /api/v1/notifications/merchant-login-notify-team
 *
 * Body (one of):
 * - { "merchant_id" } — load Merchent; summary from business name, name, mobile, city
 * - { "business_name" | "buisnessName", "name", "mobile_number" } — explicit summary parts
 *
 * Optional: `data` — merged into push payload; merchant fields added when loaded from DB.
 */
export async function notifyTeamMerchantLoginHandler(req, res) {
  try {
    const body = req.body || {};
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
        .select(
          "name mobile_number buisnessName buisnessAddress is_verified profileImage document"
        )
        .lean();

      if (!merchant) {
        return res.status(404).json({ success: false, message: "Merchant not found" });
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
        return res.status(400).json({
          success: false,
          message: "Provide merchant_id, or business_name / name / mobile_number",
        });
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
    return res.status(status).json({
      success: result.success,
      message: result.success ? "Team notified" : result.error || result.message || "Failed",
      teamPush: result,
    });
  } catch (error) {
    console.error("notifyTeamMerchantLoginHandler:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
}
