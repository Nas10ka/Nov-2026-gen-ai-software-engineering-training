import { Injectable } from '@nestjs/common';
import { TransactionType } from '../common/validation';

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

@Injectable()
export class TransactionRepository {
  private readonly transactions = new Map<string, Transaction>();

  all(): Transaction[] {
    return Array.from(this.transactions.values(), transaction => ({ ...transaction }));
  }

  find(id: string): Transaction | undefined {
    const transaction = this.transactions.get(id);
    return transaction ? { ...transaction } : undefined;
  }

  save(transaction: Transaction): Transaction {
    this.transactions.set(transaction.id, { ...transaction });
    return { ...transaction };
  }
}
