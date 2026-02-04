import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RatingService } from './rating.service.js';

const submitRatingSchema = z.object({
  serviceInstanceId: z.string().uuid(),
  serviceRequestId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().max(1000).optional(),
  reviewTextHi: z.string().max(1000).optional(),
});

export function createRatingController(service: RatingService): Router {
  const router = Router();

  // POST /api/v1/ratings — Submit a rating
  router.post(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = submitRatingSchema.parse(req.body);
        const user = req.user!;
        const rating = await service.submitRating({
          ...body,
          customerId: user.id,
          cityId: user.cityId!,
        });
        res.status(201).json({ success: true, data: rating });
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
