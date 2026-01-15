import WishlistItem from '@/models/wishlist';
import mongoose from 'mongoose';

export interface CreateWishlistItemOptions {
  buyer?: mongoose.Types.ObjectId | string;
  product?: mongoose.Types.ObjectId | string;
}

/**
 * Create a wishlist item
 */
export async function createWishlistItem(options: CreateWishlistItemOptions = {}) {
  const { buyer, product } = options;

  if (!buyer) {
    throw new Error('WishlistItem buyer is required');
  }

  if (!product) {
    throw new Error('WishlistItem product is required');
  }

  const wishlistItem = await WishlistItem.create({
    buyer,
    product,
  });

  return wishlistItem;
}

/**
 * Create multiple wishlist items
 */
export async function createWishlistItems(
  buyer: mongoose.Types.ObjectId | string,
  products: (mongoose.Types.ObjectId | string)[]
) {
  const items = [];
  for (const product of products) {
    items.push(await createWishlistItem({ buyer, product }));
  }
  return items;
}
