import express from "express";
import {
  createOrderStatusUpdateNotification,
  sendOrderCreatedNotification,
} from "../controllers/notificationController.js";
import {
  sendJobApplicationNotificationToPoster,
  notifyLaboursForNewJobRequirement,
  notifyLabourSelectedForTheJob,
} from "../controllers/labourJobsNotifications/immidiate.js";
import { getJobsWithNoApplicationDueForNotify } from "../controllers/labourJobsNotifications/scheduled.js";
import {
  notifyTeamNewOrderHandler,
  notifyTeamOrderInitiateHandler,
  notifyTeamSimpleNewOrderHandler,
} from "../controllers/orderNotifications/immidiate.js";
import { notifyTeamLabourRegisteredHandler } from "../controllers/labourController/immidiate.js";
import { notifyTeamMerchantLoginHandler } from "../controllers/merchantController/immidiate.js";
import { notifyTeamUserRegisteredHandler } from "../controllers/userNotifications/immidiate.js";
import {
  sendEquipmentBookingInitiatedNotification,
  sendEquipmentBookingConfirmedNotification,
} from "../controllers/equipmentNotifications/immidiate.js";

const router = express.Router();

router.post("/new-merchant-order", sendOrderCreatedNotification);
router.post("/new-order-notify-team", notifyTeamNewOrderHandler);
router.post("/new-order-simple-notify-team", notifyTeamSimpleNewOrderHandler);
router.post("/order-initiate-notify-team", notifyTeamOrderInitiateHandler);
router.post("/labour-registered-notify-team", notifyTeamLabourRegisteredHandler);
router.post("/merchant-login-notify-team", notifyTeamMerchantLoginHandler);
router.post("/user-registered-notify-team", notifyTeamUserRegisteredHandler);
router.post("/order-status-update", createOrderStatusUpdateNotification);
router.post("/job-applied", sendJobApplicationNotificationToPoster);
/** Alias — same handler (some clients call this path from docs / main server) */
router.post("/job-requirement-application", sendJobApplicationNotificationToPoster);
router.post("/job-requirement-notify-labours", notifyLaboursForNewJobRequirement);
router.get("/job-requirement-no-application-due", getJobsWithNoApplicationDueForNotify);
/** Not in original server routes — team WhatsApp + labour Expo when a worker is selected */
router.post("/job-requirement-labour-selected", notifyLabourSelectedForTheJob);

/** Equipment rental bookings (renter + contractor) */
router.post(
  "/equipment-booking-initiated",
  sendEquipmentBookingInitiatedNotification
);
router.post(
  "/equipment-booking-confirmed",
  sendEquipmentBookingConfirmedNotification
);

export default router;
