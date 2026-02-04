/**
 * Tests for RatingController covering HTTP endpoints.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { createRatingController } from '../rating.controller.js';
import { RatingService } from '../rating.service.js';
import { AppError } from '../../../core/errors/app-error.js';

// Simple error handler for tests (mirrors production error handler)
function testErrorHandler(err: any, _req: any, res: any, _next: any) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(err.toJSON());
    return;
  }
  // Zod validation errors
  if (err.name === 'ZodError') {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: err.errors },
    });
    return;
  }
  res.status(500).json({ success: false, error: { code: 'INTERNAL', message: err.message } });
}

describe('RatingController', () => {
  let app: express.Express;
  let mockService: {
    submitRating: ReturnType<typeof vi.fn>;
    getRating: ReturnType<typeof vi.fn>;
    getRatingsForAgent: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockService = {
      submitRating: vi.fn(),
      getRating: vi.fn(),
      getRatingsForAgent: vi.fn(),
    };

    app = express();
    app.use(express.json());

    // Inject a fake user on every request for auth simulation
    app.use((req: any, _res: any, next: any) => {
      req.user = {
        id: 'cust-001',
        role: 'CUSTOMER',
        cityId: 'city-001',
        email: 'customer@test.local',
      };
      next();
    });

    const router = createRatingController(mockService as unknown as RatingService);
    app.use('/ratings', router);
    app.use(testErrorHandler);
  });

  describe('POST / - Submit a rating', () => {
    test('returns 201 on successful rating submission', async () => {
      // Given
      const ratingPayload = {
        serviceInstanceId: '550e8400-e29b-41d4-a716-446655440000',
        rating: 4,
        reviewText: 'Good service',
      };

      const createdRating = {
        id: 'rating-001',
        ...ratingPayload,
        customerId: 'cust-001',
        cityId: 'city-001',
      };
      mockService.submitRating.mockResolvedValue(createdRating);

      // When
      const response = await supertest(app)
        .post('/ratings')
        .send(ratingPayload);

      // Then
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(createdRating);
      expect(mockService.submitRating).toHaveBeenCalledWith({
        serviceInstanceId: '550e8400-e29b-41d4-a716-446655440000',
        rating: 4,
        reviewText: 'Good service',
        customerId: 'cust-001',
        cityId: 'city-001',
      });
    });

    test('returns 400 on invalid input (missing rating/stars)', async () => {
      // Given: payload without rating field
      const invalidPayload = {
        serviceInstanceId: '550e8400-e29b-41d4-a716-446655440000',
        // rating is missing
        reviewText: 'Good service',
      };

      // When
      const response = await supertest(app)
        .post('/ratings')
        .send(invalidPayload);

      // Then
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('returns 400 when rating is out of range', async () => {
      // Given: rating > 5
      const invalidPayload = {
        serviceInstanceId: '550e8400-e29b-41d4-a716-446655440000',
        rating: 10,
      };

      // When
      const response = await supertest(app)
        .post('/ratings')
        .send(invalidPayload);

      // Then
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('returns 400 when serviceInstanceId is not a valid UUID', async () => {
      // Given
      const invalidPayload = {
        serviceInstanceId: 'not-a-uuid',
        rating: 4,
      };

      // When
      const response = await supertest(app)
        .post('/ratings')
        .send(invalidPayload);

      // Then
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('passes optional serviceRequestId and reviewTextHi when provided', async () => {
      // Given
      const ratingPayload = {
        serviceInstanceId: '550e8400-e29b-41d4-a716-446655440000',
        serviceRequestId: '660e8400-e29b-41d4-a716-446655440000',
        rating: 5,
        reviewText: 'Excellent',
        reviewTextHi: 'उत्कृष्ट',
      };
      mockService.submitRating.mockResolvedValue({ id: 'rating-002', ...ratingPayload });

      // When
      const response = await supertest(app)
        .post('/ratings')
        .send(ratingPayload);

      // Then
      expect(response.status).toBe(201);
      expect(mockService.submitRating).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceRequestId: '660e8400-e29b-41d4-a716-446655440000',
          reviewTextHi: 'उत्कृष्ट',
        }),
      );
    });

    test('forwards service errors through next()', async () => {
      // Given: service throws AppError
      const ratingPayload = {
        serviceInstanceId: '550e8400-e29b-41d4-a716-446655440000',
        rating: 4,
      };
      mockService.submitRating.mockRejectedValue(
        new AppError('SERVICE_INSTANCE_NOT_FOUND', 'Service instance not found', 404),
      );

      // When
      const response = await supertest(app)
        .post('/ratings')
        .send(ratingPayload);

      // Then
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('SERVICE_INSTANCE_NOT_FOUND');
    });
  });

  describe('GET /:serviceInstanceId - Get rating', () => {
    test('returns rating for service instance and authenticated user', async () => {
      // Given
      const ratingData = {
        id: 'rating-001',
        serviceInstanceId: 'si-001',
        customerId: 'cust-001',
        rating: 5,
        reviewText: 'Great',
      };
      mockService.getRating.mockResolvedValue(ratingData);

      // When
      const response = await supertest(app).get('/ratings/si-001');

      // Then
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(ratingData);
      expect(mockService.getRating).toHaveBeenCalledWith('si-001', 'cust-001');
    });

    test('returns null data when no rating exists', async () => {
      // Given
      mockService.getRating.mockResolvedValue(null);

      // When
      const response = await supertest(app).get('/ratings/si-nonexistent');

      // Then
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
    });
  });

  describe('GET /agent/:agentId - Get agent ratings summary', () => {
    test('returns aggregated ratings for an agent', async () => {
      // Given
      const agentRatings = {
        ratings: [
          { id: 'r1', rating: 5 },
          { id: 'r2', rating: 4 },
        ],
        averageRating: 4.5,
        totalCount: 2,
      };
      mockService.getRatingsForAgent.mockResolvedValue(agentRatings);

      // When
      const response = await supertest(app).get('/ratings/agent/agent-001');

      // Then
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(agentRatings);
      expect(mockService.getRatingsForAgent).toHaveBeenCalledWith('agent-001');
    });

    test('returns empty ratings when agent has no ratings', async () => {
      // Given
      const emptyResult = {
        ratings: [],
        averageRating: 0,
        totalCount: 0,
      };
      mockService.getRatingsForAgent.mockResolvedValue(emptyResult);

      // When
      const response = await supertest(app).get('/ratings/agent/agent-no-reviews');

      // Then
      expect(response.status).toBe(200);
      expect(response.body.data.totalCount).toBe(0);
      expect(response.body.data.averageRating).toBe(0);
    });
  });
});
