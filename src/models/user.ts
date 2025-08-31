import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  roles: { type: [String], enum: ['buyer', 'agent', 'transporter', 'admin'], default: ['buyer'], required: true }, // multiple roles
  activeRole: { type: String, enum: ['buyer', 'agent', 'transporter', 'admin'], default: null }, // allow null if not set
  isVerified: { type: Boolean, default: false },
  verificationCode: { type: String },
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
  interests: [{ type: String }], // e.g. ["fish", "Tubers", "Grains", "Edible", "Livestock", "Vegetable"]
  resetPasswordToken: { type: String },
  resetPasswordTokenExpiry: { type: Date },
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
