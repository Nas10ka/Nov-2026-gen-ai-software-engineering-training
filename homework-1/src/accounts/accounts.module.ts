import { Controller, Get, Module, Param } from '@nestjs/common';
import { AccountParams } from '../common/validation';
import { TransactionsModule } from '../transactions/transactions.module';
import { TransactionsService } from '../transactions/transactions.service';
import { fromMinorUnits } from '../transactions/money';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get(':accountId/balance')
  balance(@Param() params: AccountParams) {
    return {
      accountId: params.accountId,
      balances: Object.fromEntries(Object.entries(this.transactions.balanceMinor(params.accountId))
        .map(([currency, amount]) => [currency, fromMinorUnits(amount)])),
    };
  }
}

@Module({ imports: [TransactionsModule], controllers: [AccountsController] })
export class AccountsModule {}
