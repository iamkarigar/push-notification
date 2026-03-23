import mongoose from "mongoose";




const laborSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  mobile_number: {
    type: String,
    required: true,
  },
  profileImage: { type: String, default: null },
  address: {
    addressLine: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    locationCoords: { type: [Number,Number], default: [0,0] },
  },
  labor_chowk_address: {
    addressLine: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    labor_chowk_coords: [Number,Number],
  },
  intro_video_url: { type: String, default: null },
  labor_chowk_coords: [Number,Number],
  last_known_location: [Number,Number],
  last_known_location_time: { type: Date, default: null },
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

  designation: {
    type: String,
  },
  bankDetails: {
    accountNumber: { type: String, default: null },
    ifscCode: { type: String, default: null },
    bankName: { type: String, default: null },
    accountHolderName: { type: String, default: null },
  },
  is_verified: {
    type: Boolean,
    default: false,
  },
  avalablity_status: {
    type: Boolean,
    default: true,
  },
  overall_rating: {
    type: Number,
    default: 0,
  },
  reviews: [
    {
      reviewerName: {
        type: String,
      },
      rating: {
        type: Number,
      },
      comment: {
        type: String,
      },
    },
  ],
  ratePerHour:{
    type: Number,
    default:null
  },
  otherRates:{
    type: {
      rateForTwoHour: {
        type: Number,
      },
      rateForFourHour: {
        type: Number,
      },
      rateForFullDay: {
        type: Number,
      },
    },
  },
  skillSet: {
    type: [{type:String, rating:String,
    experience:Number, 
    ratePerHour:Number,
    reviews:  [
      {
        reviewerName: {
          type: String,
        },
        rating: {
          type: Number,
        },
        comment: {
          type: String,
        },
      },
    ],
   }],
    default: [],
  },

  experince: { type: Number },

  // NEW FIELD: Expo Push Token
  pushToken: {
    type: String,
    default: null,
  },
});

export const LaborModel = mongoose.model("Labor", laborSchema);
// export const LaborOtpModel = mongoose.model("laborOtp", LaborOtp);
