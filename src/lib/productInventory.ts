import Product from '@/models/product';

function syncAvailability(product: any) {
  if (product.status === 'discontinued') return;
  product.status = Number(product.quantity || 0) <= 0 ? 'out_of_stock' : 'available';
}

export async function reserveProductInventory(productId: any, quantity: unknown) {
  const numericQuantity = Number(quantity);
  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
    throw new Error('Invalid product quantity');
  }

  const product: any = await Product.findById(productId);
  if (!product) {
    throw new Error('Product not found');
  }
  if (product.status === 'discontinued') {
    throw new Error('Product is discontinued');
  }
  if (numericQuantity > Number(product.quantity || 0)) {
    throw new Error('Requested quantity exceeds available stock');
  }

  product.quantity = Math.max(0, Number(product.quantity || 0) - numericQuantity);
  syncAvailability(product);
  product.updatedAt = new Date();
  await product.save();

  return product;
}

export async function releaseProductInventory(productId: any, quantity: unknown) {
  const numericQuantity = Number(quantity);
  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
    throw new Error('Invalid product quantity');
  }

  const product: any = await Product.findById(productId);
  if (!product) {
    throw new Error('Product not found');
  }

  product.quantity = Math.max(0, Number(product.quantity || 0) + numericQuantity);
  syncAvailability(product);
  product.updatedAt = new Date();
  await product.save();

  return product;
}

export async function syncProductAvailability(productId: any) {
  const product: any = await Product.findById(productId);
  if (!product) return null;
  syncAvailability(product);
  product.updatedAt = new Date();
  await product.save();
  return product;
}
