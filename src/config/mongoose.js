import mongoose from "mongoose";

/**
 * Main Karigar MongoDB (same as Karigar_server-new- MONGO_URL).
 * Required for material orders, labour job requirements, users, merchants, labours.
 */
export async function connectMongoose() {
  const uri = process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGO_URL or MONGODB_URI is required for /api/v1/notifications (mongoose models)"
    );
  }
  await mongoose.connect(uri);
  console.log(`Mongoose connected: ${mongoose.connection.host}`);
}
