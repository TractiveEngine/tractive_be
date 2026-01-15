import mongoose from 'mongoose';

const ShippingRequestSchema = new mongoose.Schema({
  buyer: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  product: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  // Product snapshot fields
  productName: { type: String, required: true },
  productImage: { type: String },
  productSizeInKG: { type: Number, required: true },
  
  // Order details
  totalKG: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  
  // Negotiation fields
  negotiable: { type: Boolean, default: false },
  negotiationPrice: { type: Number, default: null },
  
  // Payment details
  paymentMethod: { 
    type: String, 
    enum: ['transfer', 'card', 'deposit', 'cheque'],
    required: true 
  },
  bankTransferDetails: { type: String },
  
  // Assignment
  transporter: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null,
    index: true
  },
  
  // Status
  status: { 
    type: String, 
    enum: ['pending', 'in_negotiation', 'accepted', 'rejected'],
    default: 'pending',
    index: true
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
ShippingRequestSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.ShippingRequest || 
  mongoose.model('ShippingRequest', ShippingRequestSchema);
