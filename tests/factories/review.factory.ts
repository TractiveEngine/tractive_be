import Review from '@/models/review';
import mongoose from 'mongoose';

export interface CreateReviewOptions {
  agent?: mongoose.Types.ObjectId | string;
  buyer?: mongoose.Types.ObjectId | string;
  rating?: number;
  comment?: string;
}

/**
 * Create a review
 */
export async function createReview(options: CreateReviewOptions = {}) {
  const {
    agent,
    buyer,
    rating = Math.floor(Math.random() * 5) + 1,
    comment = 'Great service!',
  } = options;

  if (!agent) {
    throw new Error('Review agent is required');
  }

  if (!buyer) {
    throw new Error('Review buyer is required');
  }

  const review = await Review.create({
    agent,
    buyer,
    rating,
    comment,
  });

  return review;
}

/**
 * Create multiple reviews
 */
export async function createReviews(
  count: number,
  agent: mongoose.Types.ObjectId | string,
  buyer: mongoose.Types.ObjectId | string,
  options: Omit<CreateReviewOptions, 'agent' | 'buyer'> = {}
) {
  const reviews = [];
  for (let i = 0; i < count; i++) {
    reviews.push(await createReview({ ...options, agent, buyer }));
  }
  return reviews;
}
