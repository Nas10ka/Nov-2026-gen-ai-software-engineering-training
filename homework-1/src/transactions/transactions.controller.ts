import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CreateTransactionDto, TransactionQueryDto } from './transaction.dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Post()
  create(@Body() body: CreateTransactionDto) { return this.transactions.create(body); }

  @Get()
  list(@Query() query: TransactionQueryDto) { return this.transactions.list(query); }

  @Get(':id')
  find(@Param('id') id: string) { return this.transactions.find(id); }
}
