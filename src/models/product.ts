import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  quantity: { type: Number, default: 0 },
  unit: { type: String, default: "kg" }, // e.g. "kg", "bag", "ton"
  unitWeightKg: { type: Number, default: null },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: "Farmer" }, // Optional: Link to farmer
  images: [{ type: String }], // URLs or paths to images
  videos: [{ type: String }], // URLs or paths to videos
  status: { type: String, enum: ["available", "out_of_stock", "discontinued"], default: "available" },
  discount: { type: Number, default: 0 },
  localTransport: {
    required: { type: Boolean, default: false },
    fee: { type: Number, default: 0 },
    from: { type: String, default: null },
    to: { type: String, default: null },
    note: { type: String, default: null },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  category: { type: String },
  subcategory: { type: String },
  categories: [{ type: String }], // e.g. ["Grains", "Vegetables"]
});

export default mongoose.models.Product ||
  mongoose.model("Product", ProductSchema);
