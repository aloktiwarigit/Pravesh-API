import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RatingService } from './rating.service.js';

const submitRatingSchema = z.object({
  serviceInstanceId: z.string().uuid().optional(),
  serviceRequestId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().max(1000).optional(),
  reviewTextHi: z.string().max(1000).optional(),
}).refine(
  (data) => data.serviceInstanceId || data.serviceRequestId,
  { message: 'Either serviceInstanceId or serviceRequestId is required' },
);

export function createRatingController(service: RatingService): Router {
  const router = Router();

  // POST /api/v1/ratings — Submit a rating
  // Accepts serviceInstanceId OR serviceRequestId (Flutter sends serviceRequestId)
  router.post(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = submitRatingSchema.parse(req.body);
        const user = req.user!;

        // If only serviceRequestId provided, look up the serviceInstanceId
        let serviceInstanceId = body.serviceInstanceId;
        if (!serviceInstanceId && body.serviceRequestId) {
          serviceInstanceId = await service.resolveServiceInstanceId(body.serviceRequestId);
        }

        const rating = await service.submitRating({
          serviceInstanceId: serviceInstanceId!,
          serviceRequestId: body.serviceRequestId,
          customerId: user.id,
          cityId: user.cityId!,
          rating: body.rating,
          reviewText: body.reviewText,
          reviewTextHi: body.reviewTextHi,
        });
        res.status(201).json({ success: true, data: rating });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/v1/ratings/by-request/:serviceRequestId — Get rating via service request ID
  // Alias for Flutter which uses serviceRequestId instead of serviceInstanceId
  router.get(
    '/by-request/:serviceRequestId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const rating = await service.getRatingByServiceRequestId(
          req.params.serviceRequestId,
          user.id,
        );
        res.json({ success: true, data: rating });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/v1/ratings/:serviceInstanceId — Get rating for a service instance
  router.get(
    '/:serviceInstanceId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const rating = await service.getRating(req.params.serviceInstanceId, user.id);
        res.json({ success: true, data: rating });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/v1/ratings/agent/:agentId — Get ratings summary for an agent
  router.get(
    '/agent/:agentId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.getRatingsForAgent(req.params.agentId);
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
