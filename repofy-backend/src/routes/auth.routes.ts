import { Router } from "express";
import { handleInitiateSignup, handleVerifySignup, handleResendOtp } from "../controllers/auth.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { authRateLimit } from "../middleware/rateLimit";

const router = Router();

router.post("/auth/signup/initiate", authRateLimit, asyncHandler(handleInitiateSignup));
router.post("/auth/signup/verify", authRateLimit, asyncHandler(handleVerifySignup));
router.post("/auth/signup/resend", authRateLimit, asyncHandler(handleResendOtp));

export default router;
