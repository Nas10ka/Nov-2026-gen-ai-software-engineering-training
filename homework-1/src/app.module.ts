import { Module } from '@nestjs/common';
import { AccountsModule } from './accounts/accounts.module';
import { RateLimitingModule } from './rate-limiting/rate-limiting.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({ imports: [TransactionsModule, AccountsModule, RateLimitingModule] })
export class AppModule {}
