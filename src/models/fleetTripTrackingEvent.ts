import mongoose from 'mongoose';

const FleetTripTrackingEventSchema = new mongoose.Schema({
  fleetTrip: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FleetTrip',
    required: true,
    index: true
  },
  status: {
    type: String,
    required: true
  },
  note: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: ''
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  updatedByRole: {
    type: String,
    enum: ['admin', 'transporter', 'agent'],
    default: null
  },
  createdAt: { type: Date, default: Date.now, index: true }
});

FleetTripTrackingEventSchema.index({ fleetTrip: 1, createdAt: -1 });

export default mongoose.models.FleetTripTrackingEvent ||
  mongoose.model('FleetTripTrackingEvent', FleetTripTrackingEventSchema);
