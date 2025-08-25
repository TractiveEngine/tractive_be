import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['buyer', 'agent', 'admin'], required: true },
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
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
