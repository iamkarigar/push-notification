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

