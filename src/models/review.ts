import mongoose from 'mongoose';

const ReviewSchema = new mongoose.Schema({
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // reviewed agent
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // reviewer
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Review || mongoose.model('Review', ReviewSchema);
