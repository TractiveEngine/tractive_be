import mongoose from 'mongoose';

const FleetPaymentSchema = new mongoose.Schema({
  fleet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Truck',
    required: true,
    index: true
  },
  transporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  fleetBid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FleetBid',
    default: null
  },
  amount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'card'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'refunded'],
    default: 'pending',
    index: true
  },
  note: {
    type: String,
    default: null
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

FleetPaymentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.FleetPayment || mongoose.model('FleetPayment', FleetPaymentSchema);
