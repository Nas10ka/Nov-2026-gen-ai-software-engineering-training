import { Controller, Get, Module, Param } from '@nestjs/common';
import { AccountParams } from '../common/validation';
import { TransactionsModule } from '../transactions/transactions.module';
import { TransactionsService } from '../transactions/transactions.service';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get(':accountId/balance')
  balance(@Param() params: AccountParams) {
    return {
      accountId: params.accountId,
      balances: Object.fromEntries(Object.entries(this.transactions.balanceMinor(params.accountId))
        .map(([currency, amount]) => [currency, amount / 100])),
    };
  }
}

@Module({ imports: [TransactionsModule], controllers: [AccountsController] })
export class AccountsModule {}
