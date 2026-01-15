import mongoose from 'mongoose';

const TrackingEventSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  status: { type: String, required: true },
  note: { type: String },
  location: { type: String },
  createdAt: { type: Date, default: Date.now, index: true }
});

TrackingEventSchema.index({ order: 1, createdAt: -1 });

export default mongoose.models.TrackingEvent || mongoose.model('TrackingEvent', TrackingEventSchema);
