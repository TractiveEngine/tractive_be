import mongoose from 'mongoose';

const FarmerFollowSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
  createdAt: { type: Date, default: Date.now }
});

FarmerFollowSchema.index({ buyer: 1, farmer: 1 }, { unique: true });

export default mongoose.models.FarmerFollow || mongoose.model('FarmerFollow', FarmerFollowSchema);
