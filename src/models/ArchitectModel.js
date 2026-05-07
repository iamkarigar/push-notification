import mongoose from "mongoose";

const architectSchema = new mongoose.Schema(
  {
    name: { type: String },
    mobile_number: { type: String, required: true },
    pushToken: { type: String, default: null },
    pushTokens: { type: [String], default: [] },
    os: { type: String, default: null },
    version: { type: String, default: null },
  },
  { collection: "architects" }
);

export const ArchitectModel =
  mongoose.models.Architect || mongoose.model("Architect", architectSchema);
