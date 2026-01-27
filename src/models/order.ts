import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  products: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, required: true }
    }
  ],
  totalAmount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid', 'delivered'], default: 'pending' },
  transportStatus: { type: String, enum: ['pending', 'picked', 'on_transit', 'delivered'], default: 'pending' },
  transporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // transporter user reference
  address: { type: String },
  idempotencyKey: { type: String, index: true, sparse: true },
  orderSignature: { type: String, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.models.Order || mongoose.model('Order', OrderSchema);
