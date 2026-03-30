import { LabourRequirementModel } from "../../models/labourRequirementModel.js";
import { LaborModel } from "../../models/laborModel.js";
import userModel from "../../models/UserModel.js";
import {
  sendNotificationLabourApp,
  sendNotificationUserApp,
} from "../notificationController.js";
import { Expo } from "expo-server-sdk";
import { notifyTeamForLabourRequirement } from "../../services/teamNotifications.js";
import { notifyTeamAboutLabourSelectionOnWhatsapp } from "../../services/teamWhatsappNotifications.js";

const LABOUR_WORK_RADIUS_KM = 15;

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

/**
 * POST body: { jobId, labourId }
 * Sends Expo push to the user who posted the job requirement
 */
export const sendJobApplicationNotificationToPoster = async (req, res) => {
  try {
    const { jobId, labourId } = req.body || {};

    if (!jobId || !labourId) {
      return res.status(400).json({
        success: false,
        message: "jobId and labourId are required in body",
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
    const body = `${labourName} applied for your requirement tomorrow, please review it and select and confirm on call.`;

    let notificationSent = false;
    try {
      const result = await sendNotificationUserApp(user.pushToken, title, body, {
        jobId,
        labourId,
        type: "job_requirement_application",
      });
      const tickets = result?.tickets || [];

      const nonErrorTicket = tickets.find((t) => t && t.status && t.status !== "error");

      if (nonErrorTicket && nonErrorTicket.id) {
        try {
          const expo = new Expo();
          const receiptIds = [nonErrorTicket.id];
          const receipts = await expo.getPushNotificationReceiptsAsync(receiptIds);

          const receipt = receipts?.[nonErrorTicket.id];
          if (receipt && receipt.status === "ok") {
            notificationSent = true;
          } else {
            console.warn("sendJobApplicationNotificationToPoster: non-ok receipt", receipt);
          }
        } catch (receiptErr) {
          console.warn("sendJobApplicationNotificationToPoster: error checking receipts", receiptErr);
        }
      } else {
        console.warn("sendJobApplicationNotificationToPoster: no valid tickets from Expo", tickets);
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

    const labours = await LaborModel.find({
      designation: { $regex: new RegExp(`^${jobTypeNorm}$`, "i") },
      pushToken: { $exists: true, $ne: null, $ne: "" },
    })
      .select("_id pushToken designation last_known_location location labor_chowk_coords address")
      .lean();

    const withinRadius = labours.filter((l) => {
      const coords = getLabourCoords(l);
      if (!coords) return false;
      const dist = haversineKm(coords.lat, coords.lng, jobLat, jobLng);
      return dist <= LABOUR_WORK_RADIUS_KM;
    });

    const titleEn = "New job requirement";
    const bodyEn = "A new job requirement is available. Please apply on the app.";
    const titleHi = "नया काम का आर्डर";
    const bodyHi = "एक नया काम का आर्डर उपलब्ध है। कृपया ऐप पर अप्लाई करें।";

    let notificationSentTo = 0;

    for (const labour of withinRadius) {
      const token = labour.pushToken;
      if (!token || !Expo.isExpoPushToken(token)) continue;

      const data = { jobId, type: "new_job_requirement" };

      try {
        const resEn = await sendNotificationLabourApp(token, titleEn, bodyEn, data);
        if (Array.isArray(resEn?.tickets) && resEn.tickets[0]?.status === "ok") {
          notificationSentTo += 1;
        }
      } catch (e) {
        console.warn(
          "notifyLaboursForNewJobRequirement: English send failed for labour",
          labour._id,
          e.message
        );
      }

      try {
        const resHi = await sendNotificationLabourApp(token, titleHi, bodyHi, data);
        if (Array.isArray(resHi?.tickets) && resHi.tickets[0]?.status === "ok") {
          notificationSentTo += 1;
        }
      } catch (e) {
        console.warn(
          "notifyLaboursForNewJobRequirement: Hindi send failed for labour",
          labour._id,
          e.message
        );
      }
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

    if (notificationSentTo === 0 && Expo.isExpoPushToken(userWhoPosted?.pushToken || "")) {
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

    await LabourRequirementModel.findByIdAndUpdate(jobId, { notificationSentTo });

    return {
      status: 200,
      json: {
        success: true,
        message: "Notifications sent to labours",
        laboursNotified: withinRadius.length,
        notificationSentTo,
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

    const labour = await LaborModel.findById(labourId).select("name pushToken").lean();
    if (!labour) {
      return res.status(404).json({ success: false, message: "Labour not found" });
    }

    const token = labour.pushToken;
    const data = { jobId, type: "labour_selected", screen: "job_details/" + jobId };
    const notifyRes = await sendNotificationLabourApp(
      token,
      "आपको काम के लिए बुलाया गया है",
      "आपने जिस काम के लिए आवेदन किया था, उसके लिए आपका चयन हो गया है। कृपया आवेदन खोलकर जांच लें।",
      data
    );

    await notifyTeamAboutLabourSelectionOnWhatsapp(jobId, labour.name, job.jobDate);

    if (Array.isArray(notifyRes?.tickets) && notifyRes.tickets[0]?.status === "ok") {
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
