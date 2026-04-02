import { Expo } from "expo-server-sdk";
import { MerchentModel } from "../models/MerchentModel.js";
import MaterialOrderModel from "../models/MaterialOrderModel.js";
import { sendNewOrderSMS } from "./smsController.js";
import { notifyUserMaterialOrderStatusFromDoc } from "../services/materialOrderUserNotifications.js";

const expo = new Expo();


export const sendNotificationUserApp = async (token, title, description, data = {}) => {
  if (!token) {
    return { success: false, message: "Missing push token" };
  }

  const expo = new Expo();
  const messages = [
    {
      to: token,           // Expo push token
      title,
      body: description,
      data: data || {},
      channelId: "custom-sound-channel",
      sound: "normal_notification.wav",
      priority: "high",
      _contentAvailable: true,
    },
  ];

  const tickets = await expo.sendPushNotificationsAsync(messages);
  return { success: true, tickets };
};
export const sendNotificationLabourApp = async (token, title, description, data = {}) => {
  if (!token) {
    return { success: false, message: "Missing push token" };
  }

  const expo = new Expo();
  const messages = [
    {
      to: token,
      title,
      body: description,
      data,
      channelId: "custom-sound-channel",
      sound: "ring_phone.mp3",
    },
  ];


  const tickets = await expo.sendPushNotificationsAsync(messages);
  return { success: true, tickets };
};

export const sendNotificationLabourAppBulk = async (tokens, title, description, data = {}) => {
  if (!tokens) {
    return { success: false, message: "Missing push tokens" };
  }
  const expo = new Expo();
  const messages = tokens.map(token => ({
    to: token,
    title,
    body: description,
    data,
    channelId: "custom-sound-channel",
    sound: "ring_phone.mp3",
  }));
  const tickets = await expo.sendPushNotificationsAsync(messages);
  return { success: true, tickets };
};


const formatAmountINR = (amount) => {
  if (amount == null || Number.isNaN(Number(amount))) return "";
  return `₹${Number(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

export const sendOrderCreatedNotification = async (req, res) => {
  try {
    const { order_id, order } = req.body;
    


    const orderDoc =  await MaterialOrderModel.findById(order_id).lean()

    console.log(orderDoc);
    

    if (!orderDoc) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const merchantId = orderDoc.merchantId;
   
    if (!merchantId) {
        console.log(orderDoc);
        
      return res.status(400).json({
        success: false,
        message: "No merchant found for this order",
      });
    }


    const merchant = await MerchentModel.findById(merchantId).lean();

    

    if (!merchant?.pushToken) {
      return res.status(400).json({
        success: false,
        message: "Merchant push token not found",
      });
    }

    const amount = formatAmountINR(orderDoc.price);
    const qty = orderDoc.bookingQuantity ? ` (qty ${orderDoc.bookingQuantity})` : "";
    const itemName = orderDoc.productName || "your product";
    const title = "New order received";
    const description = amount
      ? `A new order worth ${amount} has been placed for ${itemName}${qty}.`
      : `A new order has been placed for ${itemName}${qty}.`;


      //send expo notification to the merchant

      try{
        const sendResults = await sendNotificationUserApp(
          merchant.pushToken,
          title,
          description,
          {
            orderId: orderDoc._id,
            merchantId: merchant._id,
          }
        );
      }
      catch(e){
        console.warn("sendOrderCreatedNotification: error sending expo notification", e);
      }

      // sending sms to the merchant and us.
      try {
        await sendNewOrderSMS(merchant.mobile_number, itemName,amount,merchant.buisnessName)
      } catch (error) {
        
        console.error("error while sending SMS", error.message);
        
      }
    
    return res.json({
      success: true,
      message: "Notifications sent",
    });
  } catch (error) {
    console.error("Error sending order notification:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const createOrderStatusUpdateNotification = async (req, res) => {
  try {
    const { order_id, title, description, data } = req.body;

    if (!order_id) {
      return res
        .status(400)
        .json({ success: false, message: "order_id is required" });
    }

    const orderDoc = await MaterialOrderModel.findById(order_id).lean();
    if (!orderDoc) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const out = await notifyUserMaterialOrderStatusFromDoc(orderDoc, {
      title,
      description,
      data,
    });

    if (!out.success) {
      const status =
        out.message === "User not found for order" ||
        out.message === "User push token not found"
          ? 400
          : 500;
      return res.status(status).json({ success: false, message: out.message });
    }

    return res.json({
      success: true,
      message: "Notification sent",
      results: out.results,
    });
  } catch (error) {
    console.error("Error sending order status notification:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
