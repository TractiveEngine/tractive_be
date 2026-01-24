import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  quantity: { type: Number, default: 0 },
  unit: { type: String, default: "kg" }, // e.g. "kg", "bag", "ton"
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: "Farmer" }, // Optional: Link to farmer
  images: [{ type: String }], // URLs or paths to images
  videos: [{ type: String }], // URLs or paths to videos
  status: { type: String, enum: ["available", "out_of_stock", "discontinued"], default: "available" },
  discount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  categories: [{ type: String }], // e.g. ["Grains", "Vegetables"]
});

export default mongoose.models.Product ||
  mongoose.model("Product", ProductSchema);
