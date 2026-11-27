import type { FinanceTransaction } from './finance-store';

export type FinanceTotals = {
  income: number;
  expense: number;
  plannedExpense: number;
};

export function shiftRecurringDate(date: string, amount: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(year, month - 1 + amount, 1, 12);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

export function calculateTotals(items: FinanceTransaction[]): FinanceTotals {
  return items.reduce((result, item) => {
    if (item.type === 'income') result.income += item.amount;
    else if (item.status === 'planned') result.plannedExpense += item.amount;
    else result.expense += item.amount;
    return result;
  }, { income: 0, expense: 0, plannedExpense: 0 });
}

/** Saldo consolidado antes do primeiro dia do mês selecionado. */
export function calculateCarryOver(items: FinanceTransaction[], month: string): number {
  return items
    .filter((item) => item.date < `${month}-01` && item.status === 'paid')
    .reduce((balance, item) => balance + (item.type === 'income' ? item.amount : -item.amount), 0);
}

