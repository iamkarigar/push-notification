import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.Mixed },
    productName: { type: String },
    quantity: { type: Number },
    unitPrice: { type: Number },
    amount: { type: Number },
    sku: { type: String },
    image: { type: String },
    gstRate: { type: Number },
    gst: { type: Number },
    merchantId: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    name: { type: String },
    phone: { type: String },
    email: { type: String },
    address1: { type: String },
    address2: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
  },
  { _id: false }
);

const discountsCodeAppliedSchema = new mongoose.Schema(
  {
    code: { type: String },
    amount: { type: Number },
  },
  { _id: false }
);

const orderInitiateSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true },
    order_id: { type: String },
    paymentId: { type: String },
    paymentLink: { type: String },
    userId: { type: String, default: "" },
    serviceCharge: { type: Number, default: 0 },
    deliveryCharge: { type: Number, default: 0 },
    items: { type: [orderItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    shippingAddress: { type: shippingAddressSchema, default: null },
    paymentStatus: { type: String, default: "pending" },
    customPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
    discountsCodeApplied: {
      type: discountsCodeAppliedSchema,
      default: null,
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    _createdAt: { type: Date, default: Date.now },
  },
  {
    collection: "temp_orders",
    timestamps: false,
    strict: true,
  }
);

export const OrderInitiateModel = mongoose.model(
  "OrderInitiate",
  orderInitiateSchema,
  "temp_orders"
);
