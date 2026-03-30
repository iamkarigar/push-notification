import { sendExpoToUsersByBroadcastMobiles } from "./broadcastTeamPushByMobile.js";

/**
 * Team alerts for labour jobs / material flows — **Expo push** to internal team users
 * (`TEAM_EXPO_NOTIFY_MOBILE_NUMBERS` in `broadcastTeamPushByMobile.js`), not WhatsApp.
 */

/**
 * Notify internal team (Expo) about a new labour requirement posted on the app.
 * Same intent as the old MSG91 template: poster name, job type, date, location, link in payload.
 *
 * @returns {Promise<boolean>} true if Expo send succeeded (`success` from broadcast helper)
 */
export async function notifyTeamForLabourRequirement(
  jobId,
  name,
  date,
  location,
  jobType = "",
  buttonUrl = null
) {
  const adminUrl = buttonUrl || `https://admin.innovkarigar.com/labour/jobs/${jobId}`;
  const dateStr =
    date instanceof Date
      ? date.toISOString().slice(0, 10)
      : date != null
        ? String(date)
        : "";
  const title = "New labour requirement";
  const text = [
    `${String(name || "Someone").trim()} posted a ${String(jobType || "job").trim()} requirement.`,
    dateStr ? `Date: ${dateStr}` : null,
    location ? `Location: ${String(location).trim()}` : null,
    "Open admin for details.",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const result = await sendExpoToUsersByBroadcastMobiles(title, text, {
      type: "team_labour_requirement",
      jobId: String(jobId),
      jobType: String(jobType || ""),
      posterName: String(name || ""),
      jobDate: dateStr,
      location: location != null ? String(location) : "",
      buttonUrl: adminUrl,
    });
    if (!result.success) {
      console.warn("notifyTeamForLabourRequirement:", result.error || result.message);
    }
    return result.success === true;
  } catch (err) {
    console.error("notifyTeamForLabourRequirement:", err);
    return false;
  }
}

export async function notifyTeamForNoLabourApplied(jobId, name, date, location) {
  // TODO: Expo team push when template/flow is defined
}

/**
 * Notify internal team (Expo) about a material purchase request (e.g. checkout / order context).
 *
 * @returns {Promise<boolean>}
 */
export async function notifyTeamForMaterialPurchaseRequest(orderId, buttonUrl = null) {
  const url = buttonUrl || "https://admin.innovkarigar.com/labour/jobs";
  const title = "Material purchase request";
  const text = `New material purchase activity for order ${String(orderId)}. Check the dashboard.`;

  try {
    const result = await sendExpoToUsersByBroadcastMobiles(title, text, {
      type: "team_material_purchase",
      orderId: String(orderId),
      buttonUrl: url,
    });
    if (!result.success) {
      console.warn("notifyTeamForMaterialPurchaseRequest:", result.error || result.message);
    }
    return result.success === true;
  } catch (err) {
    console.error("notifyTeamForMaterialPurchaseRequest:", err);
    return false;
  }
}
