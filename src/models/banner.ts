import mongoose from 'mongoose';

const BannerSchema = new mongoose.Schema({
  title: { type: String, default: null },
  imageUrl: { type: String, required: true },
  link: { type: String, default: null },
  alt: { type: String, default: '' },
  position: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

BannerSchema.pre('save', function updateTimestamp(next) {
  this.updatedAt = new Date();
  next();
});

BannerSchema.index({ isActive: 1, position: 1, createdAt: -1 });

export default mongoose.models.Banner ||
  mongoose.model('Banner', BannerSchema);
