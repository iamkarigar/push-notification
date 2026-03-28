import { LaborModel } from "../../models/laborModel.js";
import { notifyTeamNewLabourRegisteredExpo } from "../../services/broadcastTeamPushByMobile.js";

/**
 * POST /api/v1/notifications/labour-registered-notify-team
 *
 * Body (one of):
 * - { "labour_id" } or { "labor_id" } — load Labour model; uses name + mobile for message
 * - { "name", "mobile_number" } — explicit (mobile optional)
 *
 * Optional: `data` — merged into push payload; labour id added when resolved from DB.
 */
export async function notifyTeamLabourRegisteredHandler(req, res) {
  try {
    const body = req.body || {};
    const { labour_id, labor_id, name, mobile_number, data: extraData } = body;
    const id = labour_id || labor_id;

    let displayLabel = null;
    let labourIdForPayload = null;

    if (id) {
      const labour = await LaborModel.findById(id).select("name mobile_number").lean();
      if (!labour) {
        return res.status(404).json({ success: false, message: "Labour not found" });
      }
      labourIdForPayload = String(labour._id);
      const parts = [labour.name, labour.mobile_number].filter((x) => x != null && String(x).trim());
      displayLabel = parts.length ? parts.join(" · ") : "A worker";
    } else {
      const n = name != null && String(name).trim() ? String(name).trim() : null;
      const m = mobile_number != null && String(mobile_number).trim() ? String(mobile_number).trim() : null;
      if (!n && !m) {
        return res.status(400).json({
          success: false,
          message: "Provide labour_id (or labor_id), or name / mobile_number",
        });
      }
      displayLabel = [n, m].filter(Boolean).join(" · ");
    }

    const pushData = {
      ...(typeof extraData === "object" && extraData !== null ? extraData : {}),
    };
    if (labourIdForPayload) pushData.labourId = labourIdForPayload;

    const result = await notifyTeamNewLabourRegisteredExpo(displayLabel, pushData);

    const status = result.success ? 200 : 400;
    return res.status(status).json({
      success: result.success,
      message: result.success ? "Team notified" : result.error || result.message || "Failed",
      teamPush: result,
    });
  } catch (error) {
    console.error("notifyTeamLabourRegisteredHandler:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
}
