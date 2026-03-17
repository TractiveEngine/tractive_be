import WishlistItem from '@/models/wishlist';
import User from '@/models/user';

type ProductLike = {
  _id?: unknown;
  images?: unknown;
  videos?: unknown;
  categories?: unknown;
  category?: unknown;
  subcategory?: unknown;
  [key: string]: unknown;
};

type AuthLike = {
  userId?: string;
};

function getProductId(value: unknown) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'toString' in value && typeof value.toString === 'function') {
    return value.toString();
  }
  return null;
}

function toUrlArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => {
    if (typeof item !== 'string') return false;
    const trimmed = item.trim().toLowerCase();
    return trimmed.startsWith('http://') || trimmed.startsWith('https://');
  });
}

export function normalizeProductCategories<T extends ProductLike>(product: T) {
  const next = { ...product } as T & {
    images: string[];
    videos: string[];
    categories: string[];
    category: string | null;
    subcategory: string | null;
  };

  next.images = toUrlArray(product.images);
  next.videos = toUrlArray(product.videos);

  const categories = Array.isArray(product.categories)
    ? product.categories.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  const explicitCategory = typeof product.category === 'string' && product.category.trim().length > 0
    ? product.category.trim()
    : null;
  const explicitSubcategory = typeof product.subcategory === 'string' && product.subcategory.trim().length > 0
    ? product.subcategory.trim()
    : null;

  next.category = explicitCategory ?? categories[0] ?? null;
  next.subcategory = explicitSubcategory ?? categories[1] ?? null;
  next.categories = Array.from(
    new Set([next.category, next.subcategory, ...categories].filter((item): item is string => !!item))
  );

  return next;
}

export function buildCategoryFields(input: {
  category?: unknown;
  subcategory?: unknown;
  categories?: unknown;
}) {
  const category = typeof input.category === 'string' && input.category.trim().length > 0
    ? input.category.trim()
    : undefined;
  const subcategory = typeof input.subcategory === 'string' && input.subcategory.trim().length > 0
    ? input.subcategory.trim()
    : undefined;
  const legacyCategories = Array.isArray(input.categories)
    ? input.categories.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  const categories = Array.from(new Set([category, subcategory, ...legacyCategories].filter((item): item is string => !!item)));

  return {
    category: category ?? legacyCategories[0] ?? null,
    subcategory: subcategory ?? legacyCategories[1] ?? null,
    categories,
  };
}

export async function attachWishlistedFlag<T extends ProductLike>(
  products: T[],
  authUserData?: AuthLike | null
) {
  if (!products.length) return products.map((product) => ({ ...normalizeProductCategories(product), wishlisted: false }));
  if (!authUserData?.userId) {
    return products.map((product) => ({ ...normalizeProductCategories(product), wishlisted: false }));
  }

  const user = await User.findById(authUserData.userId).select('_id activeRole');
  if (!user || user.activeRole !== 'buyer') {
    return products.map((product) => ({ ...normalizeProductCategories(product), wishlisted: false }));
  }

  const productIds = products
    .map((product) => getProductId(product._id))
    .filter((id): id is string => !!id);

  const wishlistItems = await WishlistItem.find({ buyer: user._id, product: { $in: productIds } }).select('product').lean();
  const wishlistedIds = new Set(wishlistItems.map((item) => item.product.toString()));

  return products.map((product) => {
    const normalized = normalizeProductCategories(product);
    return {
      ...normalized,
      wishlisted: !!(getProductId(product._id) && wishlistedIds.has(getProductId(product._id)!))
    };
  });
}

export async function attachWishlistedFlagToNestedProduct<T extends { product?: ProductLike | null }>(
  items: T[],
  authUserData?: AuthLike | null
) {
  const products = items
    .map((item) => item.product)
    .filter((product): product is ProductLike => !!product);

  const normalizedProducts = await attachWishlistedFlag(products, authUserData);
  const byId = new Map(
    normalizedProducts
      .map((product) => [getProductId(product._id), product] as const)
      .filter(([id]) => !!id)
  );

  return items.map((item) => {
    const productId = getProductId(item.product?._id);
    if (!productId) {
      return item;
    }

    return {
      ...item,
      wishlisted: true,
      product: byId.get(productId) ?? item.product,
    };
  });
}
