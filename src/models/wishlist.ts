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
    required: true,
    index: true
  }
}, { 
  timestamps: true 
});

// Unique compound index to prevent duplicate wishlist entries
WishlistItemSchema.index({ buyer: 1, product: 1 }, { unique: true });

export default mongoose.models.WishlistItem || 
  mongoose.model('WishlistItem', WishlistItemSchema);
