import mongoose from 'mongoose';

const TruckSchema = new mongoose.Schema({
  plateNumber: { type: String, required: true },
  fleetName: { type: String },
  fleetNumber: { type: String },
  iot: { type: String },
  model: { type: String },
  size: { type: String },
  capacity: { type: String },
  price: { type: Number },
  priceNegotiation: { type: Boolean, default: false },
  fleetDescription: { type: String },
  fleetStates: { type: String },
  tracker: { type: String },
  images: [{ type: String }], // URLs or paths to images
  transporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // transporter who owns the truck
  assignedDriver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  route: {
    fromState: { type: String }, // e.g. "Kaduna"
    toState: { type: String }    // e.g. "Lagos"
  },
  status: { type: String, enum: ['available', 'on_transit', 'under_maintenance'], default: 'available' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.models.Truck || mongoose.model('Truck', TruckSchema);
