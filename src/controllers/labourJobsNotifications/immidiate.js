import { LabourRequirementModel } from "../../models/labourRequirementModel.js";
import { LaborModel } from "../../models/laborModel.js";
import userModel from "../../models/UserModel.js";
import {
  sendNotificationLabourAppBulk,
  sendNotificationUserApp,
  sendNotificationUserAppBulk,
} from "../notificationController.js";
import { Expo } from "expo-server-sdk";
import { notifyTeamForLabourRequirement } from "../../services/teamNotifications.js";
import { notifyTeamAboutLabourSelectionOnWhatsapp } from "../../services/teamWhatsappNotifications.js";
import { aggregateLaboursWithinRadiusKm } from "../../services/labourGeoAggregation.js";

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

/** Poster user app: `pushTokens` (newer at end of array first), then `pushToken`. */
function resolveAllUserExpoTokens(user) {
  if (!user) return [];
  const seen = new Set();
  const out = [];
  const push = (raw) => {
    const t = raw != null ? String(raw).trim() : "";
    if (!t || seen.has(t)) return;
    if (!Expo.isExpoPushToken(t)) return;
    seen.add(t);
    out.push(t);
  };
  if (Array.isArray(user.pushTokens)) {
    for (let i = user.pushTokens.length - 1; i >= 0; i--) {
      push(user.pushTokens[i]);
    }
  }
  if (user.pushToken) push(user.pushToken);
  return out;
}

async function sendUserAppBulkChunked(tokens, title, body, data) {
  let anyOk = false;
  for (let i = 0; i < tokens.length; i += EXPO_PUSH_CHUNK) {
    const slice = tokens.slice(i, i + EXPO_PUSH_CHUNK);
    const res = await sendNotificationUserAppBulk(slice, title, body, data);
    if (res?.tickets?.some((t) => t?.status === "ok")) anyOk = true;
  }
  return anyOk;
}

/**
 * Same as POST `/api/v1/notifications/job-applied` — callable from change streams (no HTTP).
 * @param {string} jobId — labour requirement `_id`
 * @param {string} labourId — worker `_id`
 * @returns {Promise<{ success: boolean, statusCode: number, notificationSent: boolean, message: string }>}
 */
export async function runNotifyPosterOfJobApplication(jobId, labourId) {
  try {
    if (!jobId || !labourId) {
      return {
        success: false,
        statusCode: 400,
        notificationSent: false,
        message: "jobId and labourId are required",
      };
    }

    const job = await LabourRequirementModel.findById(jobId).lean();
    if (!job) {
      return {
        success: false,
        statusCode: 404,
        notificationSent: false,
        message: "Job requirement not found",
      };
    }

    const posterUserId = job.postedBy;
    if (!posterUserId) {
      return {
        success: false,
        statusCode: 400,
        notificationSent: false,
        message: "Job has no poster (postedBy)",
      };
    }

    const labour = await LaborModel.findById(labourId).select("name").lean();
    if (!labour) {
      return {
        success: false,
        statusCode: 404,
        notificationSent: false,
        message: "Labour not found",
      };
    }

    const user = await userModel.findById(posterUserId).select("pushToken pushTokens").lean();
    if (!user) {
      return {
        success: false,
        statusCode: 404,
        notificationSent: false,
        message: "User (job poster) not found",
      };
    }

    const posterTokens = resolveAllUserExpoTokens(user);
    if (!posterTokens.length) {
      return {
        success: false,
        statusCode: 400,
        notificationSent: false,
        message: "User has not enabled push notifications",
      };
    }

    const labourName = (labour.name && String(labour.name).trim()) || "A worker";
    const title = "Someone is interested in your job";
    const messageBody = `${labourName} is interested to come and work on your requirement. Open the app to review their profile and confirm.`;

    const pushData = {
      jobId,
      labourId,
      type: "job_requirement_application",
    };

    let notificationSent = false;
    try {
      console.log(
        `[job-applied] notifying poster (jobId=${jobId}, labourId=${labourId}, tokens=${posterTokens.length})`
      );
      const accepted = await sendUserAppBulkChunked(
        posterTokens,
        title,
        messageBody,
        pushData
      );
      if (accepted) {
        notificationSent = true;
      } else {
        console.warn("runNotifyPosterOfJobApplication: no ok ticket from Expo");
      }
    } catch (sendErr) {
      console.error("runNotifyPosterOfJobApplication: send failed", sendErr);
    }

    await LabourRequirementModel.findByIdAndUpdate(jobId, { notificationSent });

    return {
      success: true,
      statusCode: 200,
      notificationSent,
      message: notificationSent
        ? "Notification sent to job poster"
        : "Notification not accepted by Expo (poster may still get nothing)",
    };
  } catch (error) {
    console.error("runNotifyPosterOfJobApplication:", error);
    return {
      success: false,
      statusCode: 500,
      notificationSent: false,
      message: error.message || "Failed to send notification",
    };
  }
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

    const out = await runNotifyPosterOfJobApplication(jobId, labourId);
    return res.status(out.statusCode).json({
      success: out.success,
      message: out.message,
      notificationSent: out.notificationSent,
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

    /** Prebook jobs notify team only; nearby workers are not broadcast to. */
    const isPrebook =
      String(job.type ?? "broadcast").trim().toLowerCase() === "prebook";

    let withinRadius = [];
    /** Distinct labours for whom at least one push (En or Hi) was accepted by Expo */
    let laboursNotifiedOk = 0;

    if (!isPrebook) {
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

      /** Distance + radius in MongoDB ($expr haversine); designation/push filters stay in $match. */
      let geoCandidates = await aggregateLaboursWithinRadiusKm(
        LaborModel,
        labourQuery,
        jobLat,
        jobLng,
        LABOUR_WORK_RADIUS_KM
      );

      const fromMongoQuery = geoCandidates.length;
      if (!fromMongoQuery) {
        console.warn(
          `[notifyLabours] no workers within ${LABOUR_WORK_RADIUS_KM}km + job type/push filters (karigarDB.labors).`
        );
      }

      withinRadius = geoCandidates.filter((l) => labourMatchesJobType(l, jobTypeNorm));
      const afterManualRefine = withinRadius.length;
      const droppedByManualRefine = fromMongoQuery - afterManualRefine;

      if (fromMongoQuery > 0) {
        if (droppedByManualRefine > 0) {
          console.log(
            `[notifyLabours] sources: mongo aggregate=${fromMongoQuery} → manual labourMatchesJobType refine: kept ${afterManualRefine}, dropped ${droppedByManualRefine} (jobId=${jobId})`
          );
        } else {
          console.log(
            `[notifyLabours] sources: ${fromMongoQuery} candidate(s) from mongo aggregate only; manual refine unchanged (jobId=${jobId})`
          );
        }
      }

      const titleEn = "New job requirement";
      const bodyEn = "A new job requirement is available. Please apply on the app.";
      const titleHi = "नया काम का आर्डर";
      const bodyHi = "एक नया काम का आर्डर उपलब्ध है। कृपया ऐप पर अप्लाई करें।";

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
    } else {
      console.log(
        `[notifyLabours] skip labour Expo pushes (type=prebook, jobId=${jobId}); team notify still sent`
      );
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

    if (
      !isPrebook &&
      laboursNotifiedOk === 0 &&
      Expo.isExpoPushToken(userWhoPosted?.pushToken || "")
    ) {
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
        message: isPrebook
          ? "Team notified; labour broadcasts skipped (prebook)"
          : "Notifications sent to labours",
        labourNotifySkippedPrebook: isPrebook,
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
