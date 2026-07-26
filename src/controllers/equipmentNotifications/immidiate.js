import {
  notifyEquipmentBookingConfirmed,
  notifyEquipmentBookingInitiated,
} from "../../services/equipmentBookingNotifications.js";

/**
 * POST /api/v1/notifications/equipment-booking-initiated
 * Body: { booking_id } | { bookingId }
 */
export async function sendEquipmentBookingInitiatedNotification(req, res) {
  try {
    const bookingId = req.body?.booking_id || req.body?.bookingId;
    if (!bookingId) {
      return res
        .status(400)
        .json({ success: false, message: "booking_id is required" });
    }

    const result = await notifyEquipmentBookingInitiated(bookingId);
    if (!result.success) {
      return res.status(404).json(result);
    }
    return res.json({
      success: true,
      message: "Equipment booking initiated notifications sent",
      ...result,
    });
  } catch (error) {
    console.error("equipment-booking-initiated notify error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/v1/notifications/equipment-booking-confirmed
 * Body: { booking_id } | { bookingId }
 */
export async function sendEquipmentBookingConfirmedNotification(req, res) {
  try {
    const bookingId = req.body?.booking_id || req.body?.bookingId;
    if (!bookingId) {
      return res
        .status(400)
        .json({ success: false, message: "booking_id is required" });
    }

    const result = await notifyEquipmentBookingConfirmed(bookingId);
    if (!result.success) {
      return res.status(404).json(result);
    }
    return res.json({
      success: true,
      message: "Equipment booking confirmed notifications sent",
      ...result,
    });
  } catch (error) {
    console.error("equipment-booking-confirmed notify error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
