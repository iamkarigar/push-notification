import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  uniqueOrderId: {
    type: String,
    required: true,
  },

  price: { type: String },
  bookingQuantity: { type: String },
  deleveryAddress: {
    addressLine: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    pincode: { type: String, default: null },
  },
  deleveryLocation: {
    locationName: {
      type: String,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    latitude: {
      type: Number,
      default: null,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  orderStatus: {
    type: String,
    default: "pending",
  },
  payment: {
    paymentId: {
      type: String,
      required: true,
    },
    paymentDetails: {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      payerr: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true,
      },
      payee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Merchent",
        required: true,
      },
      price: { type: String },
      finalPrice: { type: String },
      bookingQuantity: { type: String },
    },
    paymentType: {
      type: String,
      default: "phone-pay",
    },
    paymentMode: {
      type: String,
      default: "Online",
    },
    paymentStatus: {
      type: String,
      default: "pending",
    },
    Setteled: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
});

const MerchentSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  mobile_number: {
    type: String,
    required: true,
  },
  buisnessName: {
    type: String,
  },
  os:{
    type:String,
    default:null
  },
  app_version:{
    type:String,
    default: null
  },
  lastActiveAt:{
    type:Date,
    default: null
  },
  profileImage: { type: String, default: null },
  buisnessAddress: {
    addressLine: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
  },
  shopImage: { type: String, default: null },
  document: [
    {
      type: String,
    },
  ],
  location: {
    locationName: {
      type: String,
    },
    longitude: {
      type: Number,
    },
    latitude: {
      type: Number,
    },
  },
  GSTINnumber: {
    type: String,
  },
  shopCoords: [Number,Number],
  specifyDeleveryVehical: {
    type: String,
  },
  deleveryAreas: {
    type: String,
  },
  is_verified: {
    type: Boolean,
    default: false,
  },
  overall_rating: {
    type: Number,
  },
  reviews: [
    {
      rating: {
        type: Number,
      },
      comment: {
        type: String,
      },
    },
  ],
  bankDetails: {
    accountNumber: { type: String, default: null },
    ifscCode: { type: String, default: null },
    bankName: { type: String, default: null },
    accountHolderName: { type: String, default: null },
  },
  orders: [orderSchema],
  pushToken: {
    type: String,
    default: null,
  },
  pushTokens: {
    type: [String],
    default: [],
  },
  highestOffPercentage: {
    type: Number,
  },
  images: {type: [String]}
});

export const MerchentModel = mongoose.model("Merchent", MerchentSchema);
