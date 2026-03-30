import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import Farmer from '@/models/farmer';
import Product from '@/models/product';
import Review from '@/models/review';
import SellerFollow from '@/models/sellerFollow';
import Order from '@/models/order';
import mongoose from 'mongoose';
import { getAuthUser } from '@/lib/apiAuth';
import { attachWishlistedFlag } from '@/lib/productPayload';

// GET /api/sellers/:id - seller profile
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const authUser = await getAuthUser(request);

  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid seller id' }, { status: 400 });
  }

  const seller = await User.findById(id);
  if (!seller) {
    return NextResponse.json({ success: false, message: 'Seller not found' }, { status: 404 });
  }

  const farmers = await Farmer.find({ createdBy: id });
  const followersCount = await SellerFollow.countDocuments({ seller: seller._id });
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
  const skip = (page - 1) * limit;
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const category = searchParams.get('category');
  const subcategory = searchParams.get('subcategory');

  const productQuery: Record<string, unknown> = { owner: id };
  if (status) productQuery.status = status;
  if (search) {
    const regex = new RegExp(search, 'i');
    productQuery.$or = [{ name: regex }, { description: regex }];
  }
  if (category && subcategory) {
    productQuery.categories = { $all: [category, subcategory] };
  } else if (category) {
    productQuery.categories = category;
  } else if (subcategory) {
    productQuery.categories = subcategory;
  }

  const ratingAgg = await Review.aggregate([
    { $match: { agent: seller._id } },
    {
      $group: {
        _id: '$agent',
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);
  const averageRating = ratingAgg[0]?.averageRating ?? 0;
  const totalReviews = ratingAgg[0]?.totalReviews ?? 0;
  const rateStatus =
    averageRating >= 4.5 ? 'Excellent' :
    averageRating >= 3.5 ? 'Good' :
    averageRating > 0 ? 'Average' : 'Not rated';

  const yearsOfExperience = Math.max(
    0,
    new Date().getFullYear() - new Date(seller.createdAt || new Date()).getFullYear()
  );

  const salesAgg = await Order.aggregate([
    { $unwind: '$products' },
    {
      $lookup: {
        from: 'products',
        localField: 'products.product',
        foreignField: '_id',
        as: 'productDoc'
      }
    },
    { $unwind: '$productDoc' },
    { $match: { 'productDoc.owner': new mongoose.Types.ObjectId(id), status: { $in: ['paid', 'delivered'] } } },
    {
      $group: {
        _id: '$buyer',
        salesAmount: { $sum: { $multiply: ['$products.quantity', '$productDoc.price'] } }
      }
    },
    {
      $group: {
        _id: null,
        customers: { $sum: 1 },
        amountOfSales: { $sum: '$salesAmount' }
      }
    }
  ]);
  const customerNumber = salesAgg[0]?.customers ?? 0;
  const amountOfSales = salesAgg[0]?.amountOfSales ?? 0;

  const [productsCount, filteredProductsCount, products, recommendations] = await Promise.all([
    Product.countDocuments({ owner: id }),
    Product.countDocuments(productQuery),
    Product.find(productQuery)
      .select('_id name description price quantity unit unitWeightKg images status createdAt discount categories category subcategory')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Product.find({
      owner: seller._id,
      status: 'available'
    })
      .select('_id name images price unit unitWeightKg categories category subcategory')
      .sort({ createdAt: -1 })
      .limit(8)
  ]);

  const normalizedProducts = await attachWishlistedFlag(
    products.map((product) => product.toObject()),
    authUser ? { userId: authUser._id.toString() } : null
  );
  const normalizedRecommendations = await attachWishlistedFlag(
    recommendations.map((product) => product.toObject()),
    authUser ? { userId: authUser._id.toString() } : null
  );

  return NextResponse.json(
    {
      success: true,
      data: {
        sellerId: seller._id.toString(),
        name: seller.name || seller.businessName,
        isVerified: !!seller.isVerified,
        image: seller.image || null,
        location: [seller.state, seller.country].filter(Boolean).join(', ') || null,
        followersCount,
        email: seller.email,
        phoneNumbers: seller.phone ? [seller.phone] : [],
        yearsOfExperience,
        sellerYear: yearsOfExperience,
        bio: seller.bio || null,
        sellerBio: seller.bio || null,
        rating: averageRating,
        averageRating,
        rateStatus,
        totalReviews,
        customerNumber,
        amountOfSales,
        roles: seller.roles,
        activeRole: seller.activeRole,
        productsCount,
        farmersCount: farmers.length,
        recommendations: normalizedRecommendations,
        products: normalizedProducts,
        productFilters: {
          category,
          subcategory,
          search,
          status,
        }
      },
      pagination: {
        total: filteredProductsCount,
        page,
        limit
      },
    },
    { status: 200 }
  );
}
