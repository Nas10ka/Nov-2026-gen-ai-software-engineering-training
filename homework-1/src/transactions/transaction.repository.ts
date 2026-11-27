import { Injectable } from '@nestjs/common';
import { TransactionType } from '../common/validation';
import { fromMinorUnits, toMinorUnits } from './money';

export interface Transaction {
  id: string;
  fromAccount: string | null;
  toAccount: string | null;
  amount: number;
  currency: string;
  type: TransactionType;
  timestamp: string;
  status: 'completed';
}

export interface StoredTransaction extends Omit<Transaction, 'amount'> {
  amountMinor: number;
}

function toResponse(transaction: StoredTransaction): Transaction {
  const { amountMinor, ...fields } = transaction;
  return { ...fields, amount: fromMinorUnits(amountMinor) };
}

@Injectable()
export class TransactionRepository {
  private readonly transactions = new Map<string, StoredTransaction>();

  snapshot(): StoredTransaction[] {
    return Array.from(this.transactions.values(), transaction => ({ ...transaction }));
  }

  all(): Transaction[] {
    return Array.from(this.transactions.values(), toResponse);
  }

  find(id: string): Transaction | undefined {
    const transaction = this.transactions.get(id);
    return transaction ? toResponse(transaction) : undefined;
  }

  save(transaction: Transaction): Transaction {
    const { amount, ...fields } = transaction;
    const stored = { ...fields, amountMinor: toMinorUnits(amount) };
    this.transactions.set(transaction.id, stored);
    return toResponse(stored);
  }
}
