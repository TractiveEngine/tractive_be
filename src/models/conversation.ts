import mongoose from 'mongoose';

const ConversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  isClosed: {
    type: Boolean,
    default: false,
    index: true
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for finding user conversations
ConversationSchema.index({ participants: 1, isClosed: 1 });

// Update timestamp on save
ConversationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.Conversation || 
  mongoose.model('Conversation', ConversationSchema);
