import { PrismaClient } from '@prisma/client';
import { AppError } from '../../core/errors/app-error.js';

export class RatingService {
  constructor(private readonly prisma: PrismaClient) {}

  async submitRating(params: {
    serviceInstanceId: string;
    serviceRequestId?: string;
    customerId: string;
    agentId?: string;
    rating: number;
    reviewText?: string;
    reviewTextHi?: string;
    cityId: string;
  }) {
    if (params.rating < 1 || params.rating > 5) {
      throw new AppError('VALIDATION_INVALID_RATING', 'Rating must be between 1 and 5', 400);
    }

    // Verify service instance exists
    const instance = await this.prisma.serviceInstance.findUnique({
      where: { id: params.serviceInstanceId },
    });

    if (!instance) {
      throw new AppError('SERVICE_INSTANCE_NOT_FOUND', 'Service instance not found', 404);
    }

    // Upsert: allow updating an existing rating
    const rating = await this.prisma.serviceRating.upsert({
      where: {
        serviceInstanceId_customerId: {
          serviceInstanceId: params.serviceInstanceId,
          customerId: params.customerId,
        },
      },
      update: {
        rating: params.rating,
        reviewText: params.reviewText,
        reviewTextHi: params.reviewTextHi,
      },
      create: {
        serviceInstanceId: params.serviceInstanceId,
        serviceRequestId: params.serviceRequestId,
        customerId: params.customerId,
        agentId: params.agentId ?? instance.assignedAgentId,
        rating: params.rating,
        reviewText: params.reviewText,
        reviewTextHi: params.reviewTextHi,
        cityId: params.cityId,
      },
    });

    return rating;
  }

  async getRating(serviceInstanceId: string, customerId: string) {
    return this.prisma.serviceRating.findUnique({
      where: {
        serviceInstanceId_customerId: {
          serviceInstanceId,
          customerId,
        },
      },
    });
  }

  async getRatingsForAgent(agentId: string) {
    const ratings = await this.prisma.serviceRating.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
    });

    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0;

    return {
      ratings,
      averageRating: Math.round(avgRating * 10) / 10,
      totalCount: ratings.length,
    };
  }
}
