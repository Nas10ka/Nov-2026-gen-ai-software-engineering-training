import { Inject, Injectable, Module, NestMiddleware } from '@nestjs/common';
import { normalizeIp, ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { NextFunction, Request, Response } from 'express';

const RATE_LIMIT = { name: 'default', ttl: 60_000, limit: 100, blockDuration: 60_000 } as const;

@Injectable()
export class IpRateLimiter implements NestMiddleware {
  constructor(@Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage) {}

  async use(request: Request, response: Response, next: NextFunction): Promise<void> {
    const tracker = normalizeIp(request.ip ?? request.socket.remoteAddress ?? 'unknown', 128);
    // Share one quota across controllers and handlers for each IP.
    const { name, ttl, limit, blockDuration } = RATE_LIMIT;
    const result = await this.storage.increment(`${name}:${tracker}`, ttl, limit, blockDuration, name);
    if (result.isBlocked) {
      response.header('Retry-After', String(Math.max(1, result.timeToBlockExpire)));
      response.status(429).json({ error: 'ThrottlerException: Too Many Requests' });
      return;
    }
    response.header('X-RateLimit-Limit', String(limit));
    response.header('X-RateLimit-Remaining', String(Math.max(0, limit - result.totalHits)));
    response.header('X-RateLimit-Reset', String(result.timeToExpire));
    next();
  }
}

@Module({
  imports: [ThrottlerModule.forRoot([RATE_LIMIT])],
  providers: [IpRateLimiter],
  exports: [IpRateLimiter],
})
export class RateLimitingModule {}
