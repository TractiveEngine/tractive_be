import mongoose from 'mongoose';

const FleetBidSchema = new mongoose.Schema({
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
  amount: {
    type: Number,
    required: true
  },
  counterAmount: {
    type: Number,
    default: null
  },
  message: {
    type: String,
    default: null
  },
  responseMessage: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'countered'],
    default: 'pending',
    index: true
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

FleetBidSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.FleetBid || mongoose.model('FleetBid', FleetBidSchema);
