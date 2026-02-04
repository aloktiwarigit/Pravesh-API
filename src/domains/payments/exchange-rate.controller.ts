// Story 13-3: Exchange Rate API Controller
import { Router, Request, Response, NextFunction } from 'express';
import { ExchangeRateService } from './exchange-rate.service.js';

export function exchangeRateRoutes(service: ExchangeRateService): Router {
  const router = Router();

  // GET /api/v1/exchange-rates/rates
  router.get(
    '/rates',
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const rates = await service.getRates();
        res.json({
          success: true,
          data: {
            rates,
            disclaimer:
              'Exchange rates are indicative and subject to change at payment time.',
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/exchange-rates/convert?amountPaise=1500000&currency=USD
  router.get(
    '/convert',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const amountPaise = parseInt(req.query.amountPaise as string);
        const currency = req.query.currency as string;

        if (isNaN(amountPaise) || !currency) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_MISSING_PARAMS',
              message: 'amountPaise and currency query params are required',
            },
          });
          return;
        }

        const result = await service.convertFromInr(amountPaise, currency);
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
