/**
 * Simple in-memory metrics collector for basic observability.
 *
 * TODO: Replace with prom-client (Prometheus) or StatsD client for production at scale.
 * This in-memory implementation does not persist across restarts and is per-process only.
 */

interface MethodMetrics {
  count: number;
  totalDurationMs: number;
  errorCount: number;
}

class MetricsCollector {
  private startTime = Date.now();
  private routeMetrics: Map<string, MethodMetrics> = new Map();
  private totalRequests = 0;
  private totalErrors = 0;

  /**
   * Record a completed request.
   */
  recordRequest(method: string, path: string, statusCode: number, durationMs: number): void {
    this.totalRequests++;
    const isError = statusCode >= 400;
    if (isError) {
      this.totalErrors++;
    }

    // Normalize path: strip IDs (UUIDs and numeric) to reduce cardinality
    const normalizedPath = path.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id',
    ).replace(/\/\d+/g, '/:id');

    const key = `${method} ${normalizedPath}`;
    const existing = this.routeMetrics.get(key) || { count: 0, totalDurationMs: 0, errorCount: 0 };
    existing.count++;
    existing.totalDurationMs += durationMs;
    if (isError) {
      existing.errorCount++;
    }
    this.routeMetrics.set(key, existing);
  }

  /**
   * Return a snapshot of all collected metrics.
   */
  getSnapshot() {
    const uptimeMs = Date.now() - this.startTime;
    const routes: Record<string, { count: number; avgDurationMs: number; errorCount: number }> = {};

    for (const [key, m] of this.routeMetrics.entries()) {
      routes[key] = {
        count: m.count,
        avgDurationMs: m.count > 0 ? Math.round(m.totalDurationMs / m.count) : 0,
        errorCount: m.errorCount,
      };
    }

    return {
      uptimeMs,
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      routes,
    };
  }
}

// Singleton instance
export const metrics = new MetricsCollector();
