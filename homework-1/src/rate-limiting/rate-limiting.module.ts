import { ExecutionContext, Injectable, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Injectable()
export class IpThrottlerGuard extends ThrottlerGuard {
  protected generateKey(_context: ExecutionContext, tracker: string, name: string): string {
    // Share one quota across controllers and handlers for each IP.
    return `${name}:${tracker}`;
  }
}

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  providers: [{ provide: APP_GUARD, useClass: IpThrottlerGuard }],
})
export class RateLimitingModule {}
