import mongoose from 'mongoose';

const BidSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // agent who owns the product
  amount: { type: Number, required: true },
  counterOffer: { type: Number, default: null },
  responseMessage: { type: String, default: null },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'countered'], default: 'pending' },
  message: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

if (mongoose.models.Bid) {
  delete mongoose.models.Bid;
}

export default mongoose.model('Bid', BidSchema);
