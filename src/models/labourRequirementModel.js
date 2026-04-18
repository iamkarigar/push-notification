import mongoose from "mongoose";

// Allowed job types (app sends e.g. "Mason", "Electrician" – normalize to lowercase)
export const JOB_TYPES = [
  "plumber",
  "electrician",
  "painter",
  "carpenter",
  "mason",
  "helper",
  "other",
];
// contactMode: how user wants to be contacted
export const CONTACT_MODES = ["phone", "app"]; // "apply" from app is mapped to "app"

export const JOB_REQUIREMENT_STATUSES = ["pending", "confirmed", "cancelled", "completed"];

const paymentDetailsSchema = new mongoose.Schema(
  {
    paymentId: { type: String },
    paidOn: { type: Date, default: null },
    paidAmount: { type: Number, default: null },
    /** `{ [chargeDisplayName]: amountRupees }` — server catalogue only; set by Razorpay link flow. */
    extraCharges: { type: mongoose.Schema.Types.Mixed, default: null },
    paymentMode: { type: String, default: "offline" },
    paymentStatus: { type: String, default: "unpaid" },
    /** PayU Payment Links (admin labour job checkout). */
    paymentLinkUrl: { type: String, default: null },
    /** Razorpay Payment Link (labour order checkout). */
    razorpayPaymentLinkId: { type: String, default: null },
    razorpayReferenceId: { type: String, default: null },
    amountPaise: { type: Number, default: null },
    razorpayLinkCreatedAt: { type: Date, default: null },

  },
  { _id: false }
);
// Same shape as elsewhere: from Google Geocode (getAddressObjectFromString)
// location: GeoJSON Point for $geoNear / 2dsphere (coordinates = [lng, lat])
const addressSchema = new mongoose.Schema(
  {
    addressLine: { type: String },
    addressInput: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    locationCoords: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: null },
    },
  },
  { _id: false }
);

const labourRequirementSchema = new mongoose.Schema(

  {
    dateCreated: {
      type: Date,
      default: Date.now,
    },
    // App fields
    type: {
      type: String,
      enum: ["prebook", "broadcast"],
      default: "broadcast",
    },
    jobDate: { type: Date, default: null },
    address: {
      type: addressSchema,
      required: true,
    },
    hoursRequired: {
      type: Number,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      default: "pending",
      enum: JOB_REQUIREMENT_STATUSES,
    },
    statusDetails: {
      selectedLabourIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Labor",
        },
      ],
      totalOrderValue: { type: Number, default: null },
      paymentDetails: {
        type: paymentDetailsSchema,
        default: null,
      },
      /** Admin / ops free-text (e.g. payment, visit outcome). */
      notes: { type: String, default: null },
      /** Set when Razorpay payment link is fully paid (prebook checkout complete). */
      prebookEnteredAt: { type: Date, default: null },
    },
    jobType: {
      type: String,
      required: true,
      enum: JOB_TYPES,
    },
    minPrice: { type: Number, default: null },
    maxPrice: { type: Number, default: null },
    contactMode: {
      type: String,
      required: true,
      enum: CONTACT_MODES,
    },
    contactPhone: { type: String, default: null },
    jobIntroUrl: { type: String, default: null },
    locationCoords: { type: [Number,Number], required: true },
    selectionNotificationSent: { type: Boolean, default: false },
    selectionNotificationDelivered: { type: Boolean, default: false },
    teamNotifed : { type: Boolean, default: false },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    // Set when we send application notification to poster; true if Expo accepted the push, false otherwise
    notificationSent: { type: Boolean, default: null },
    // Number of "new job requirement" notifications successfully sent to labourers (Expo ticket ok)
    notificationSentTo: { type: Number, default: null },
  },
  {
    timestamps: false,
  }
);

labourRequirementSchema.index({ "address.locationCoords": "2dsphere" });

// Use Orders database and labour_job_requirements collection (same pattern as MaterialOrderModel)
const ordersDb = mongoose.connection.useDb("Orders");
export const LabourRequirementModel = ordersDb.model(
  "LabourRequirement",
  labourRequirementSchema,
  "labour_job_requirements"
);
