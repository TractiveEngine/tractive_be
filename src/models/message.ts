import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  sentAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Index for efficient message retrieval
MessageSchema.index({ conversation: 1, sentAt: -1 });

export default mongoose.models.Message || 
  mongoose.model('Message', MessageSchema);
