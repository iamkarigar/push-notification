import mongoose from "mongoose";

/**
 * Lean read model for equipment rental orders in Orders DB.
 * Matches Karigar_server-new- EquipmentBooking collection.
 */
const equipmentBookingSchema = new mongoose.Schema(
  {
    equipmentId: { type: mongoose.Schema.Types.ObjectId },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    renterId: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    bookingDate: { type: String },
    bookingEndDate: { type: String, default: null },
    rentalType: { type: String },
    hours: { type: Number, default: null },
    baseAmount: { type: Number },
    deposit: { type: Number, default: 0 },
    totalAmount: { type: Number },
    paymentStatus: { type: String },
    status: { type: String },
    uniqueOrderId: { type: String },
    equipmentSnapshot: {
      title: { type: String },
      images: [{ type: String }],
      locationName: { type: String },
      deliveryRadiusKm: { type: Number },
    },
  },
  {
    collection: "equipmentbookings",
    timestamps: true,
    strict: false,
  }
);

const ordersDb = mongoose.connection.useDb("Orders", { useCache: true });
const EquipmentBookingModel =
  ordersDb.models.EquipmentBooking ||
  ordersDb.model("EquipmentBooking", equipmentBookingSchema, "equipmentbookings");

export default EquipmentBookingModel;
