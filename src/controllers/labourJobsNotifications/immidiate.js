import { LabourRequirementModel } from "../../models/labourRequirementModel.js";
import { LaborModel } from "../../models/laborModel.js";
import userModel from "../../models/UserModel.js";
import {
  sendNotificationLabourAppBulk,
  sendNotificationUserApp,
} from "../notificationController.js";
import { Expo } from "expo-server-sdk";
import { notifyTeamForLabourRequirement } from "../../services/teamNotifications.js";
import { notifyTeamAboutLabourSelectionOnWhatsapp } from "../../services/teamWhatsappNotifications.js";

const LABOUR_WORK_RADIUS_KM = 15;

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Job `jobType` is normalized lowercase (e.g. carpenter). Labour `designation` may be
 * "Carpenter", "Wood carpenter", or only listed under `skillSet[].type` — strict ^type$ missed those.
 */
function labourMatchesJobType(labour, jobTypeNorm) {
  if (!jobTypeNorm) return false;
  if (jobTypeNorm === "other") return true;

  const d = (labour.designation || "").trim().toLowerCase();
  if (d === jobTypeNorm) return true;
  if (d.includes(jobTypeNorm)) return true;

  const word = new RegExp(`\\b${escapeRegex(jobTypeNorm)}\\b`, "i");
  if (word.test(labour.designation || "")) return true;

  const skills = labour.skillSet || [];
  for (const s of skills) {
    const skillName =
      s && typeof s === "object" && s.type != null ? String(s.type) : String(s || "");
    const sn = skillName.trim().toLowerCase();
    if (sn === jobTypeNorm || sn.includes(jobTypeNorm) || word.test(skillName)) return true;
  }
  return false;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getLabourCoords(labour) {
  if (Array.isArray(labour.last_known_location) && labour.last_known_location.length >= 2) {
    const lng = Number(labour.last_known_location[0]);
    const lat = Number(labour.last_known_location[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  if (labour.location?.latitude != null && labour.location?.longitude != null) {
    const lat = Number(labour.location.latitude);
    const lng = Number(labour.location.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  if (Array.isArray(labour.labor_chowk_coords) && labour.labor_chowk_coords.length >= 2) {
    const lng = Number(labour.labor_chowk_coords[0]);
    const lat = Number(labour.labor_chowk_coords[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  if (Array.isArray(labour.address?.locationCoords) && labour.address.locationCoords.length >= 2) {
    const lng = Number(labour.address.locationCoords[0]);
    const lat = Number(labour.address.locationCoords[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
}

const EXPO_PUSH_CHUNK = 99;

/** All unique valid Expo tokens: `pushTokens` (newer entries later in array first), then `pushToken`. */
function resolveAllLabourExpoTokens(labour) {
  if (!labour) return [];
  const seen = new Set();
  const out = [];
  const push = (raw) => {
    const t = raw != null ? String(raw).trim() : "";
    if (!t || seen.has(t)) return;
    if (!Expo.isExpoPushToken(t)) return;
    seen.add(t);
    out.push(t);
  };
  if (Array.isArray(labour.pushTokens)) {
    for (let i = labour.pushTokens.length - 1; i >= 0; i--) {
      push(labour.pushTokens[i]);
    }
  }
  if (labour.pushToken) push(labour.pushToken);
  return out;
}

async function sendLabourAppBulkChunked(tokens, title, body, data) {
  let anyOk = false;
  for (let i = 0; i < tokens.length; i += EXPO_PUSH_CHUNK) {
    const slice = tokens.slice(i, i + EXPO_PUSH_CHUNK);
    const res = await sendNotificationLabourAppBulk(slice, title, body, data);
    if (res?.tickets?.some((t) => t?.status === "ok")) anyOk = true;
  }
  return anyOk;
}

/**
 * POST body: { jobId, labourId }
 * Sends Expo push to the user who posted the job requirement
 */
export const sendJobApplicationNotificationToPoster = async (req, res) => {
  try {
    const payload = req.body || {};
    const jobId = payload.jobId || payload.job_id;
    const labourId = payload.labourId || payload.labour_id;

    if (!jobId || !labourId) {
      return res.status(400).json({
        success: false,
        message: "jobId (or job_id) and labourId (or labour_id) are required in body",
      });
    }

    const job = await LabourRequirementModel.findById(jobId).lean();
    if (!job) {
      return res.status(404).json({ success: false, message: "Job requirement not found" });
    }

    const posterUserId = job.postedBy;
    if (!posterUserId) {
      return res.status(400).json({ success: false, message: "Job has no poster (postedBy)" });
    }

    const labour = await LaborModel.findById(labourId).select("name").lean();
    if (!labour) {
      return res.status(404).json({ success: false, message: "Labour not found" });
    }

    const user = await userModel.findById(posterUserId).select("pushToken").lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User (job poster) not found" });
    }

    if (!user.pushToken || !Expo.isExpoPushToken(user.pushToken)) {
      return res.status(400).json({
        success: false,
        message: "User has not enabled push notifications",
      });
    }

    const labourName = labour.name || "A worker";
    const title = "New application for your requirement";
    const messageBody = `${labourName} applied for your requirement tomorrow, please review it and select and confirm on call.`;

    let notificationSent = false;
    try {
      const result = await sendNotificationUserApp(user.pushToken, title, messageBody, {
        jobId,
        labourId,
        type: "job_requirement_application",
      });
      const tickets = result?.tickets || [];
      // Expo accepts the message when ticket.status === "ok". Receipts are often still
      // "pending" if fetched immediately — do not treat that as failure.
      const accepted = tickets.some((t) => t && t.status === "ok");
      if (accepted) {
        notificationSent = true;
      } else {
        console.warn("sendJobApplicationNotificationToPoster: no ok ticket from Expo", tickets);
      }
    } catch (sendErr) {
      console.error("sendJobApplicationNotificationToPoster: send failed", sendErr);
    }

    await LabourRequirementModel.findByIdAndUpdate(jobId, { notificationSent });

    return res.status(200).json({
      success: true,
      message: "Notification sent to job poster",
      notificationSent,
    });
  } catch (error) {
    console.error("sendJobApplicationNotificationToPoster:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send notification",
    });
  }
};

/**
 * Same logic as POST `/api/v1/notifications/job-requirement-notify-labours` — callable without HTTP.
 * @param {string} jobId
 * @returns {Promise<{ status: number, json: object }>}
 */
export async function runNotifyLaboursForNewJobRequirement(jobId) {
  try {
    if (!jobId) {
      return {
        status: 400,
        json: { success: false, message: "jobId is required in body" },
      };
    }

    const job = await LabourRequirementModel.findById(jobId).lean();
    if (!job) {
      return { status: 404, json: { success: false, message: "Job requirement not found" } };
    }

    const jobCoords = job.address.locationCoords.coordinates;
    if (!Array.isArray(jobCoords) || jobCoords.length < 2) {
      return {
        status: 400,
        json: { success: false, message: "Job requirement has no location coordinates" },
      };
    }

    const jobLng = Number(jobCoords[0]);
    const jobLat = Number(jobCoords[1]);
    if (!Number.isFinite(jobLat) || !Number.isFinite(jobLng)) {
      return {
        status: 400,
        json: { success: false, message: "Job location coordinates invalid" },
      };
    }

    const jobTypeNorm = (job.jobType || "").trim().toLowerCase();

    const hasReachablePush = {
      $or: [
        { pushToken: { $exists: true, $nin: [null, ""] } },
        { pushTokens: { $elemMatch: { $nin: [null, ""] } } },
      ],
    };

    const labourQuery = { $and: [hasReachablePush] };
    if (jobTypeNorm && jobTypeNorm !== "other") {
      const typeRegex = new RegExp(escapeRegex(jobTypeNorm), "i");
      labourQuery.$and.push({
        $or: [
          { designation: { $regex: typeRegex } },
          { "skillSet.type": { $regex: typeRegex } },
        ],
      });
    }

    const labours = await LaborModel.find(labourQuery)
      .select(
        "_id pushToken pushTokens designation skillSet last_known_location location labor_chowk_coords address"
      )
      .lean();

    if (!labours.length) {
      console.warn(
        `[notifyLabours] no workers matched job type + push filters (karigarDB.labors).`
      );
    }

    const withinRadius = labours.filter((l) => {
      const coords = getLabourCoords(l);
      if (!coords) return false;
      const dist = haversineKm(coords.lat, coords.lng, jobLat, jobLng);
      if (dist > LABOUR_WORK_RADIUS_KM) return false;
      return labourMatchesJobType(l, jobTypeNorm);
    });

    const titleEn = "New job requirement";
    const bodyEn = "A new job requirement is available. Please apply on the app.";
    const titleHi = "नया काम का आर्डर";
    const bodyHi = "एक नया काम का आर्डर उपलब्ध है। कृपया ऐप पर अप्लाई करें।";

    /** Distinct labours for whom at least one push (En or Hi) was accepted by Expo */
    let laboursNotifiedOk = 0;

    for (const labour of withinRadius) {
      const tokens = resolveAllLabourExpoTokens(labour);
      if (!tokens.length) continue;

      const data = { jobId, type: "new_job_requirement" };
      let labourGotOk = false;

      try {
        const okEn = await sendLabourAppBulkChunked(tokens, titleEn, bodyEn, data);
        if (okEn) labourGotOk = true;
      } catch (e) {
        console.warn(
          "notifyLaboursForNewJobRequirement: English send failed for labour",
          labour._id,
          e.message
        );
      }

      try {
        const okHi = await sendLabourAppBulkChunked(tokens, titleHi, bodyHi, data);
        if (okHi) labourGotOk = true;
      } catch (e) {
        console.warn(
          "notifyLaboursForNewJobRequirement: Hindi send failed for labour",
          labour._id,
          e.message
        );
      }

      if (labourGotOk) laboursNotifiedOk += 1;
    }

    const userWhoPosted = await userModel
      .findById(job.postedBy)
      .select("name pushToken")
      .lean();
    await notifyTeamForLabourRequirement(
      jobId,
      userWhoPosted?.name,
      job.jobDate,
      job.address?.addressLine,
      job.jobType || ""
    );

    if (laboursNotifiedOk === 0 && Expo.isExpoPushToken(userWhoPosted?.pushToken || "")) {
      console.log(
        `[notifyLabours] sending no labours available (jobId=${jobId}, poster=${userWhoPosted?._id ?? "unknown"})`
      );
      try {
        await sendNotificationUserApp(
          userWhoPosted.pushToken,
          "Oh no! labours available right now",
          "Sorry, there's no labours available at your work location at the moment. Now that you are here, we will hire more labours so you won't have any problems in the future.",
          { jobId, type: "no_labours_available" }
        );
      } catch (e) {
        console.warn("notifyLaboursForNewJobRequirement: failed to notify job poster", e.message);
      }
    }

    await LabourRequirementModel.findByIdAndUpdate(jobId, { notificationSentTo: laboursNotifiedOk });

    return {
      status: 200,
      json: {
        success: true,
        message: "Notifications sent to labours",
        laboursNotified: withinRadius.length,
        laboursNotifiedOk,
        notificationSentTo: laboursNotifiedOk,
      },
    };
  } catch (error) {
    console.error("runNotifyLaboursForNewJobRequirement:", error);
    return {
      status: 500,
      json: { success: false, message: error.message || "Failed to send notifications" },
    };
  }
}

/**
 * POST body: { jobId }
 */
export const notifyLaboursForNewJobRequirement = async (req, res) => {
  try {
    const { jobId } = req.body || {};
    const out = await runNotifyLaboursForNewJobRequirement(jobId);
    return res.status(out.status).json(out.json);
  } catch (error) {
    console.error("notifyLaboursForNewJobRequirement:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send notifications",
    });
  }
};

/**
 * POST body: { jobId, labourId }
 * Expo to labour + WhatsApp to TEAM_MEMBERS_NUMBERS
 */
export const notifyLabourSelectedForTheJob = async (req, res) => {
  const { jobId, labourId } = req.body || {};

  try {
    if (!jobId || !labourId) {
      return res.status(400).json({
        success: false,
        message: "jobId and labourId are required in body",
      });
    }

    const job = await LabourRequirementModel.findById(jobId).lean();
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const labour = await LaborModel.findById(labourId).select("name pushToken pushTokens").lean();
    if (!labour) {
      return res.status(404).json({ success: false, message: "Labour not found" });
    }

    const tokens = resolveAllLabourExpoTokens(labour);
    if (!tokens.length) {
      return res.status(400).json({
        success: false,
        message: "Labour has no valid Expo push token",
      });
    }
    const data = { jobId, type: "labour_selected", screen: "job_details/" + jobId };
    const titleSel = "आपको काम के लिए बुलाया गया है";
    const bodySel =
      "आपने जिस काम के लिए आवेदन किया था, उसके लिए आपका चयन हो गया है। कृपया आवेदन खोलकर जांच लें।";
    let notifyOk = false;
    try {
      notifyOk = await sendLabourAppBulkChunked(tokens, titleSel, bodySel, data);
    } catch (e) {
      console.warn("notifyLabourSelectedForTheJob: bulk send failed", labourId, e.message);
    }

    await notifyTeamAboutLabourSelectionOnWhatsapp(jobId, labour.name, job.jobDate);

    if (notifyOk) {
      return res.status(200).json({ success: true, message: "Notification sent to labour" });
    }
    return res.status(500).json({ success: false, message: "Failed to send notification to labour" });
  } catch (error) {
    await notifyTeamAboutLabourSelectionOnWhatsapp(jobId, "unknown", "unknown");
    console.error("notifyLabourSelectedForTheJob:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send notifications",
    });
  }
};
