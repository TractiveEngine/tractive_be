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
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FleetBooking',
    default: null
  },
  amount: {
    type: Number,
    required: true
  },
  loadWeightKg: {
    type: Number,
    required: true,
    min: 1
  },
  wholeTruckOnly: {
    type: Boolean,
    default: false
  },
  shipmentItems: [
    {
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      productName: { type: String, default: null },
      quantity: { type: Number, required: true },
      unit: { type: String, default: 'kg' },
      loadWeightKg: { type: Number, required: true }
    }
  ],
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
  refundReason: {
    type: String,
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
