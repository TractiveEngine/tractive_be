import mongoose from 'mongoose';

const FleetTripSchema = new mongoose.Schema({
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
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null
  },
  bookingIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FleetBooking'
  }],
  paymentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FleetPayment'
  }],
  orderIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],
  buyerIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['planned', 'loaded', 'on_transit', 'arrived', 'delivered', 'cancelled'],
    default: 'planned',
    index: true
  },
  origin: { type: String, default: null },
  destination: { type: String, default: null },
  currentLocation: { type: String, default: null },
  currentLatitude: { type: Number, default: null },
  currentLongitude: { type: Number, default: null },
  trackingCode: { type: String, default: null, index: true },
  loadWeightKg: { type: Number, required: true, min: 1 },
  wholeTruckOnly: { type: Boolean, default: false },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

FleetTripSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.FleetTrip || mongoose.model('FleetTrip', FleetTripSchema);
