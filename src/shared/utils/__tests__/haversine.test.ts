import { describe, it, expect } from 'vitest';
import { haversineDistance } from '../haversine';

describe('haversineDistance', () => {
  it('returns 0 for same coordinates', () => {
    expect(haversineDistance(26.8467, 80.9462, 26.8467, 80.9462)).toBe(0);
  });

  it('calculates distance between Lucknow landmarks', () => {
    // Gomti Nagar to Hazratganj (~5 km)
    const dist = haversineDistance(26.8567, 81.0046, 26.8535, 80.9462);
    expect(dist).toBeGreaterThan(4);
    expect(dist).toBeLessThan(7);
  });

  it('handles antipodal points', () => {
    const dist = haversineDistance(0, 0, 0, 180);
    expect(Math.round(dist)).toBe(20015); // ~half Earth circumference
  });

  it('handles negative coordinates', () => {
    const dist = haversineDistance(-33.8688, 151.2093, -37.8136, 144.9631);
    // Sydney to Melbourne (~714 km)
    expect(dist).toBeGreaterThan(700);
    expect(dist).toBeLessThan(730);
  });
});
