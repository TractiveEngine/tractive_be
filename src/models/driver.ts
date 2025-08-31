import mongoose from 'mongoose';

const DriverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String },
  licenseNumber: { type: String },
  trackingNumber: { type: String },
  transporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // transporter who onboarded
  assignedTruck: { type: mongoose.Schema.Types.ObjectId, ref: 'Truck' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.models.Driver || mongoose.model('Driver', DriverSchema);
