import userModel from "../models/UserModel.js";
import { sendNotificationLabourApp } from "../controllers/notificationController.js";

/**
 * Push to the customer (user app) when a material order's status is known.
 * Used by POST /order-status-update and by the materials collection change stream.
 */
export async function notifyUserMaterialOrderStatusFromDoc(orderDoc, options = {}) {
  if (!orderDoc?._id) {
    return { success: false, message: "Invalid order" };
  }

  const userId = orderDoc.userId;
  if (!userId) {
    return { success: false, message: "User not found for order" };
  }

  const user = await userModel.findById(userId).lean();
  if (!user?.pushToken) {
    return { success: false, message: "User push token not found" };
  }

  const orderStatus = orderDoc.orderStatus;
  const itemName = orderDoc.productName || "your product";
  const notifyTitle =
    options.title || `Order status updated to ${orderStatus}`;
  const notifyDescription =
    options.description ||
    `Your order for ${itemName} has been ${orderStatus}.`;

  const sendResults = await sendNotificationLabourApp(
    user.pushToken,
    notifyTitle,
    notifyDescription,
    {
      screen: "order-details",
      orderId: orderDoc._id,
      userId: user._id,
      status: orderStatus,
      ...(options.data || {}),
    }
  );

  return { success: true, results: sendResults };
}
