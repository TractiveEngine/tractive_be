import mongoose from 'mongoose';

const TruckSchema = new mongoose.Schema({
  plateNumber: { type: String, required: true },
  model: { type: String },
  capacity: { type: String },
  tracker: { type: String },
  images: [{ type: String }], // URLs or paths to images
  transporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // transporter who owns the truck
  assignedDriver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  route: {
    fromState: { type: String }, // e.g. "Kaduna"
    toState: { type: String }    // e.g. "Lagos"
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.models.Truck || mongoose.model('Truck', TruckSchema);
