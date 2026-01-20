import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: { type: String, required: true },
  roles: {
    type: [String],
    enum: ["buyer", "agent", "transporter", "admin"],
    default: [],
    required: true,
  },
  activeRole: {
    type: String,
    enum: ["buyer", "agent", "transporter", "admin"],
    default: null,
  },
  isVerified: { type: Boolean, default: false },
  verificationCode: { type: String },
  verificationTokenExpiry: { type: Date, default: null }, // ✅ needed for expiry check
  lastResendAt: { type: Date, default: null }, // optional
  resendCountToday: { type: Number, default: 0 }, // optional
  name: { type: String },
  phone: { type: String },
  businessName: { type: String },
  nin: { type: String },
  businessCAC: { type: String },
  address: { type: String },
  country: { type: String },
  state: { type: String },
  lga: { type: String },
  villageOrLocalMarket: { type: String },
  interests: [{ type: String }],
  resetPasswordToken: { type: String },
  resetPasswordTokenExpiry: { type: Date },
  
  // Admin management fields
  status: {
    type: String,
    enum: ["active", "suspended", "removed"],
    default: "active"
  },
  agentApprovalStatus: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: null
  },
  approvalNotes: { type: String },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
UserSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.User || mongoose.model("User", UserSchema);
