import Product from '@/models/product';
import mongoose from 'mongoose';

export interface CreateProductOptions {
  name?: string;
  description?: string;
  price?: number;
  quantity?: number;
  owner?: mongoose.Types.ObjectId | string;
  images?: string[];
  videos?: string[];
  categories?: string[];
}

/**
 * Create a product
 */
export async function createProduct(options: CreateProductOptions = {}) {
  const {
    name = `Product ${Date.now()}`,
    description = 'Test product description',
    price = Math.floor(Math.random() * 10000) + 100,
    quantity = Math.floor(Math.random() * 100) + 1,
    owner,
    images = [],
    videos = [],
    categories = ['grain'],
  } = options;

  if (!owner) {
    throw new Error('Product owner is required');
  }

  const product = await Product.create({
    name,
    description,
    price,
    quantity,
    owner,
    images,
    videos,
    categories,
  });

  return product;
}

/**
 * Create multiple products
 */
export async function createProducts(
  count: number,
  owner: mongoose.Types.ObjectId | string,
  options: Omit<CreateProductOptions, 'owner'> = {}
) {
  const products = [];
  for (let i = 0; i < count; i++) {
    products.push(await createProduct({ ...options, owner }));
  }
  return products;
}
