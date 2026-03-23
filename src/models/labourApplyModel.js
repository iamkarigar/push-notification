import mongoose from "mongoose";

const labourApplySchema = new mongoose.Schema(
  {
    labourJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LabourRequirement",
      required: true,
    },
    appliedOn: {
      type: Date,
      default: Date.now,
      required: true,
    },
    labourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Labor",
      required: true,
    },
    selectedAt: {
      type: Date,
      default: null,
    },
    contactAt: {
      type: Date,
      default: null,
    },
    viewedAt: {
      type: Date,
      default: null,
    },
    phoneNumberAvailable: {
      type: Boolean,
      default: false,
    },
    // Review from poster when closing the job (1–5 each)
    behaviourRating: { type: Number, default: null, min: 1, max: 5 },
    skillRating: { type: Number, default: null, min: 1, max: 5 },
  },
  { timestamps: true }
);

// Use Orders database and labour_job_applications collection
const ordersDb = mongoose.connection.useDb("Orders");
export const LabourApplyModel = ordersDb.model(
  "LabourApply",
  labourApplySchema,
  "labour_job_applications"
);
