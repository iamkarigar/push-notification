import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    mobile_number: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      trim: true,
    },
    profileImage: { type: String, default: null },
    GSTINumber: {
      type: String,
      default: null,
    },
    businessName: {
      type: String,
      default: null,
    },
    businessAddress: {
      type: String,
      default: null,
    },
    email: {
      type: String,
    },
    document: [
      {
        type: String,
      },
    ],
    location: {
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
    address: [
      {
        addressLine: { type: String },
        addressInput: { type: String },
        city: { type: String },
        state: { type: String },
        pincode: { type: String },
        landmark: { type: String },
        locationCoords : [Number,Number],
      },
    ],
        bankDetails: {
      accountNumber: { type: String, default: null },
      ifscCode: { type: String, default: null },
      bankName: { type: String, default: null },
      accountHolderName: { type: String, default: null },
    },
    productCart: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          default: 1,
        },
      }
      ],
    productOrders: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        uniqueOrderId: {
          type: String,
          required: true,
        },
        price: { type: String },
        bookingQuantity: { type: String },
        orderStatus: { type: String, default: "pending" },
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
          createdAt: {
            type: Date,
            default: Date.now,
          },
        },
      },
    ],
    architectOrders: [
      {
        architectId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Architect",
          required: true,
        },
        uniqueOrderId: {
          type: String,
          required: true,
        },
        concern: { type: String },
        description: { type: String },
        price: { type: String },
        images: [
          {
            type: String,
          },
        ],
        status: { type: String, default: "pending" },
        architectAddress: {
          addressLine: { type: String, default: null },
          city: { type: String, default: null },
          state: { type: String, default: null },
          pincode: { type: String, default: null },
        },

        createdAt: {
          type: Date,
          default: Date.now,
        },
        payment: {
          paymentId: {
            type: String,
            required: true,
          },
          paymentDetails: {
            payerr: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "users",
              required: true,
            },
            payee: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Architect",
              required: true,
            },
            price: { type: String },
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
          createdAt: {
            type: Date,
            default: Date.now,
          },
        },
      },
    ],
    orders: [
      {
        labourId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Labor",
          required: true,
        },
        location: {
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
        address: [{ type: String, required: true }],
        workDetails: {
          images: [{ type: String }],
          workTitle: { type: String },
          workDescription: { type: String },
        },
        phone: { type: String },
        dateAndTime: {
          date: { type: String, required: true }, // ISO string format for simplicity
          slots: { type: String, required: true },
          bookingType: { type: String, required: true }, // "full-time", "2-hour", "4-hour"
          createdAt: {
            type: Date,
            default: Date.now,
          },
        },
        uniqueOrderId: {
          type: String,
          required: true,
        },
        completed: { type: Boolean, default: false },
        unavailable: {
          type: Boolean,
          default: false,
        },
        status: {
          type: String,
          default: "pending",
        },
        completed: { type: Boolean, default: false },
        payment: {
          paymentId: {
            type: String,
            required: true,
          },
          paymentDetails: {
            payerr: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "users",
              required: true,
            },
            payee: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Labor",
              required: true,
            },
            price: { type: String },
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
          createdAt: {
            type: Date,
            default: Date.now,
          },
        },
        createdAt: { type: Date, default: Date.now() },
      },
    ],
    pushToken: {
      type: String,
      default: null,
    },
    pushTokens: {
      type: [String],
      default: [],
    },
    signedUpAt: { type: Date, default: Date.now() },
    lastActiveAt: { type: Date, default: Date.now() },
    os : {type:String, default: "android"},
    version : {type:String}
  },
  { timestamps: true }
);

const userModel = mongoose.model("users", userSchema);

export default userModel;
