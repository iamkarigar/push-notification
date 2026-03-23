import mongoose from "mongoose";

const deleveryAddressSchema = new mongoose.Schema(
  {
    addressLine: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    pincode: { type: String, default: null },
  },
  { _id: false }
);

const deleveryLocationSchema = new mongoose.Schema(
  {
    locationName: { type: String, default: null },
    longitude: { type: Number, default: null },
    latitude: { type: Number, default: null },
  },
  { _id: false }
);

const paymentDetailsSchema = new mongoose.Schema(
  {
    productId: { type: String },
    payerr: { type: String },
    payee: { type: mongoose.Schema.Types.ObjectId, ref: "Merchent" },
    price: { type: Number },
    finalPrice: { type: Number },
    bookingQuantity: { type: Number },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    paymentId: { type: String },
    paymentDetails: { type: paymentDetailsSchema },
    paymentMode: { type: String, default: "Online" },
    paymentStatus: { type: String, default: "pending" },
  },
  { _id: false }
);

const materialOrderSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    productId: { type: String, required: true },
    userId: { type: String, required: true },
    invoiceId: { type: Number },
    images: [{ type: String }],
    productName: { type: String },
    productDescription: { type: String },
    uniqueOrderId: { type: String },
    price: { type: Number },
    discountsCodeApplied: {
      code: String,
      amount: Number,
    },
    merchantId: { type: mongoose.Schema.Types.ObjectId, ref: "Merchent" },
    userName: { type: String },
    businessPhone: { type: String },
    userPhone: { type: String },
    merchantName: { type: String },
    gstNumber: { type: String },
    businessName: { type: String },
    businessAddress: { type: String },
    hsnCode: { type: String },
    bookingQuantity: { type: Number },
    deleveryAddress: { type: deleveryAddressSchema },
    deleveryLocation: { type: deleveryLocationSchema },
    createdAt: { type: Date, default: Date.now },
    orderStatus: { type: String, default: "pending" },
    payment: { type: paymentSchema },
  },
  {
    collection: "materials",
    timestamps: false,
    strict: true, // disallow fields not defined in schema
  }
);

const ordersDb = mongoose.connection.useDb("Orders");
const MaterialOrderModel = ordersDb.model("MaterialOrder", materialOrderSchema);

export default MaterialOrderModel;
