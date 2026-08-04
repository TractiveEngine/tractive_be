import mongoose from 'mongoose';

const WishlistItemSchema = new mongoose.Schema({
  buyer: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  product: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product',
    default: null,
    index: true
  },
  fleet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Truck',
    default: null,
    index: true
  }
}, { 
  timestamps: true 
});

WishlistItemSchema.pre('validate', function(next) {
  const hasProduct = !!this.product;
  const hasFleet = !!this.fleet;
  if (hasProduct === hasFleet) {
    return next(new Error('Exactly one of product or fleet is required'));
  }
  next();
});

WishlistItemSchema.index(
  { buyer: 1, product: 1 },
  { unique: true, partialFilterExpression: { product: { $type: 'objectId' } } }
);
WishlistItemSchema.index(
  { buyer: 1, fleet: 1 },
  { unique: true, partialFilterExpression: { fleet: { $type: 'objectId' } } }
);

export default mongoose.models.WishlistItem || 
  mongoose.model('WishlistItem', WishlistItemSchema);
