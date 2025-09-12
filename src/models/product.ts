import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  quantity: { type: Number, default: 0 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  images: [{ type: String }], // URLs or paths to images
  videos: [{ type: String }], // URLs or paths to videos
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  categories: [{ type: String }], // e.g. ["maize", "grain"]
});

export default mongoose.models.Product ||
  mongoose.model("Product", ProductSchema);
