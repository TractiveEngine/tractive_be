import mongoose from 'mongoose';

const FleetBookingSchema = new mongoose.Schema({
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
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FleetPayment',
    default: null
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending_payment', 'confirmed', 'rejected', 'cancelled', 'completed'],
    default: 'pending_payment',
    index: true
  },
  note: {
    type: String,
    default: null
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

FleetBookingSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.FleetBooking || mongoose.model('FleetBooking', FleetBookingSchema);
