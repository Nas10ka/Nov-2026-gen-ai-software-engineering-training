import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import currencyCodes from 'currency-codes';
import { invalid } from '../common/validation';
import { CreateTransactionDto, TransactionQueryDto } from './transaction.dto';
import { TransactionRepository } from './transaction.repository';
import { fromMinorUnits, toMinorUnits } from './money';

@Injectable()
export class TransactionsService {
  constructor(private readonly repository: TransactionRepository) {}

  create(input: CreateTransactionDto) {
    if (!currencyCodes.code(input.currency)) invalid('currency', 'Invalid ISO 4217 currency code');
    if (input.type === 'deposit' && input.fromAccount !== undefined) {
      invalid('fromAccount', 'Deposits must only specify toAccount');
    }
    if (input.type === 'withdrawal' && input.toAccount !== undefined) {
      invalid('toAccount', 'Withdrawals must only specify fromAccount');
    }
    if (input.type === 'transfer' && input.fromAccount === input.toAccount) {
      invalid('toAccount', 'Transfer accounts must be different');
    }
    const minor = toMinorUnits(input.amount);
    const affected = new Set([input.fromAccount, input.toAccount].filter((account): account is string => !!account));
    const balances = this.balancesFor(affected);
    for (const [account, delta] of [[input.fromAccount, -minor], [input.toAccount, minor]] as const) {
      if (!account) continue;
      const current = balances.get(account)?.[input.currency] ?? 0;
      fromMinorUnits(current + delta);
    }
    return this.repository.save({
      ...input, fromAccount: input.fromAccount ?? null, toAccount: input.toAccount ?? null,
      id: randomUUID(), timestamp: new Date().toISOString(), status: 'completed',
    });
  }

  list(query: TransactionQueryDto) {
    for (const field of ['from', 'to'] as const) {
      const value = query[field];
      if (value) {
        const date = new Date(`${value}T00:00:00.000Z`);
        if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
          invalid(field, 'Date must be a valid calendar date in YYYY-MM-DD format');
        }
      }
    }
    if (query.from && query.to && query.from > query.to) invalid('to', 'Date range must not end before it starts');
    return this.repository.all().filter(transaction => {
      const day = transaction.timestamp.slice(0, 10);
      return (!query.accountId || transaction.fromAccount === query.accountId || transaction.toAccount === query.accountId)
        && (!query.type || transaction.type === query.type)
        && (!query.from || day >= query.from) && (!query.to || day <= query.to);
    });
  }

  find(id: string) {
    const transaction = this.repository.find(id);
    if (!transaction) throw new NotFoundException('Transaction not found');
    return transaction;
  }

  balanceMinor(accountId: string): Record<string, number> {
    return this.balancesFor(new Set([accountId])).get(accountId) ?? {};
  }

  private balancesFor(accounts: ReadonlySet<string>): Map<string, Record<string, number>> {
    const balances = new Map<string, Record<string, number>>();
    for (const transaction of this.repository.snapshot()) {
      for (const [account, delta] of [
        [transaction.fromAccount, -transaction.amountMinor], [transaction.toAccount, transaction.amountMinor],
      ] as const) {
        if (!account || !accounts.has(account)) continue;
        const currencies = balances.get(account) ?? {};
        currencies[transaction.currency] = (currencies[transaction.currency] ?? 0) + delta;
        balances.set(account, currencies);
      }
    }
    return balances;
  }
}
