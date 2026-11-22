import { Module } from '@nestjs/common';
import { TransactionRepository } from './transaction.repository';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  controllers: [TransactionsController],
  providers: [TransactionRepository, TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
