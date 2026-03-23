import express from "express";
import {
  sendOtpHandler,
  verifyOtpHandler,
  storeTeamTokensHandler,
} from "../controllers/teamAuthController.js";

const router = express.Router();

// POST /team/v1/send_otp  — body: { mobile_number }
router.post("/send_otp", sendOtpHandler);

// POST /team/v1/verify_otp — body: { mobile_number, otp }
router.post("/verify_otp", verifyOtpHandler);

// POST /team/v1/store-team-tokens — body: { expoPushToken }, header: Authorization: Bearer <access_Token>
router.post("/store-team-tokens", storeTeamTokensHandler);

export default router;
