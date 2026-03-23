import { ObjectId } from "mongodb";
import { getTeamUsersCollection } from "../config/db.js";
import { generateOtp, sendOtp } from "../services/otpService.js";
import {
  signToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
} from "../services/tokenService.js";

const otpStore = new Map();

export async function sendOtpHandler(req, res) {
  const { mobile_number } = req.body;
  if (!mobile_number) {
    return res
      .status(400)
      .json({ error: "Mobile number is required", success: false });
  }

  const otp = generateOtp();
  otpStore.set(mobile_number, otp);

  const isSent = await sendOtp(
    mobile_number,
    otp,
    process.env.MSG91_AUTH_KEY,
    process.env.SENDER_ID,
    process.env.TEMPLATE_ID
  );

  if (isSent) {
    res.json({ message: "OTP sent successfully", success: true });
  } else {
    res.status(500).json({ error: "Failed to send OTP", success: false });
  }
}

export async function verifyOtpHandler(req, res) {
  const { mobile_number, otp } = req.body;
  if (!mobile_number || !otp) {
    return res
      .status(400)
      .json({ error: "mobile_number and otp are required", success: false });
  }

  try {
    const users = getTeamUsersCollection();
    const storedOtp = otpStore.get(mobile_number);

    if (storedOtp !== otp) {
      return res.status(400).json({ message: "Invalid OTP", success: false });
    }
    otpStore.delete(mobile_number);

    let user = await users.findOne({ mobile_number });
    let isNewUser = false;

    if (!user) {
      const { insertedId } = await users.insertOne({
        mobile_number,
        expoPushTokens: [],
        createdAt: new Date(),
      });
      user = await users.findOne({ _id: insertedId });
      isNewUser = true;
    }

    const token = signToken(user._id.toString());
    const access_Token = signAccessToken(user._id.toString());
    const refresh_Token = signRefreshToken(user._id.toString());

    const status = isNewUser ? 201 : 200;
    const message = isNewUser ? "register successfully" : "login successfully";

    return res.status(status).json({
      message,
      token,
      refresh_Token,
      access_Token,
      user: {
        _id: user._id,
        mobile_number: user.mobile_number,
        expoPushTokens: user.expoPushTokens || [],
      },
      success: true,
    });
  } catch (err) {
    console.error("verifyOtpHandler:", err);
    return res.status(500).json({ message: "Server error", success: false });
  }
}

export async function storeTeamTokensHandler(req, res) {
  const { expoPushToken } = req.body;
  if (!expoPushToken || typeof expoPushToken !== "string") {
    return res
      .status(400)
      .json({ error: "expoPushToken (string) is required", success: false });
  }

  let userId;
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ success: false, message: "Authorization header missing" });
    }
    const decoded = verifyAccessToken(authHeader.slice(7));
    userId = decoded.userId;
  } catch (err) {
    return res
      .status(401) 
      .json({ success: false, message: "Invalid or expired token" });
  }

  try {
    const users = getTeamUsersCollection();
    const result = await users.updateOne(
      { _id: new ObjectId(userId) },
      { $addToSet: { expoPushTokens: expoPushToken.trim() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Expo push token stored",
    });
  } catch (err) {
    console.error("storeTeamTokensHandler:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
