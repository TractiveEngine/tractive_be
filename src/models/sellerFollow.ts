import mongoose from 'mongoose';

const SellerFollowSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

SellerFollowSchema.index({ buyer: 1, seller: 1 }, { unique: true });

export default mongoose.models.SellerFollow || mongoose.model('SellerFollow', SellerFollowSchema);

