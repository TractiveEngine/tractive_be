import mongoose from 'mongoose';

const FarmerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  businessName: { type: String },
  nin: { type: String },
  businessCAC: { type: String },
  bankName: { type: String },
  bankAccountName: { type: String },
  bankAccountNumber: { type: String },
  address: { type: String, required: true },
  country: { type: String },
  state: { type: String, required: true },
  lga: { type: String, required: true },
  villageOrLocalMarket: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // agent who created
  
  // Approval fields
  approvalStatus: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },
  approvalNotes: { type: String },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
FarmerSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.Farmer || mongoose.model('Farmer', FarmerSchema);
