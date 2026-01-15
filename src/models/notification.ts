import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'bid_created',
      'bid_accepted',
      'order_created',
      'order_status_changed',
      'transaction_approved',
      'transaction_declined',
      'transaction_refunded',
      'shipping_accepted',
      'shipping_rejected',
      'support_ticket_updated',
      'chat_message',
      'generic'
    ],
    default: 'generic',
    index: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index for efficient queries
NotificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

// Update timestamp on save
NotificationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.Notification || 
  mongoose.model('Notification', NotificationSchema);
