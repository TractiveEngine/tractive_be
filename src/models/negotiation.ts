import mongoose from 'mongoose';

const NegotiationOfferSchema = new mongoose.Schema({
  shippingRequest: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ShippingRequest', 
    required: true,
    index: true
  },
  transporter: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  negotiatorName: { type: String, required: true },
  amount: { type: Number, required: true },
  weightInKG: { type: Number, required: true },
  
  // Route details
  routeFrom: { type: String, required: true },
  routeTo: { type: String, required: true },
  
  // Status
  negotiationStatus: { 
    type: String, 
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
    index: true
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
NegotiationOfferSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.NegotiationOffer || 
  mongoose.model('NegotiationOffer', NegotiationOfferSchema);
