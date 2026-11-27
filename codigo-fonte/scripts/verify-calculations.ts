import assert from 'node:assert/strict';
import { calculateCarryOver, calculateTotals, shiftRecurringDate } from '../lib/finance-calculations.ts';
import type { FinanceTransaction } from '../lib/finance-store.ts';

const base = {
  createdAt: '2026-09-08T12:00:00.000Z',
  source: 'manual' as const,
  category: 'Teste',
  date: '2026-09-08',
};

const transactions: FinanceTransaction[] = [
  { ...base, id: 'income', description: 'Receita', amount: 5000, type: 'income', status: 'paid' },
  { ...base, id: 'paid', description: 'Paga', amount: 1250.5, type: 'expense', status: 'paid' },
  { ...base, id: 'planned', description: 'A vencer', amount: 499.5, type: 'expense', status: 'planned' },
];

const result = calculateTotals(transactions);
assert.deepEqual(result, { income: 5000, expense: 1250.5, plannedExpense: 499.5 });
assert.equal(result.income - result.expense, 3749.5, 'Saldo atual incorreto');
assert.equal(result.income - result.expense - result.plannedExpense, 3250, 'Saldo projetado incorreto');

const carryOver = calculateCarryOver([
  { ...base, id: 'aug-income', description: 'Agosto', amount: 2000, type: 'income', status: 'paid', date: '2026-08-20' },
  { ...base, id: 'aug-expense', description: 'Agosto', amount: 650, type: 'expense', status: 'paid', date: '2026-08-21' },
  { ...base, id: 'future', description: 'Prevista', amount: 400, type: 'expense', status: 'planned', date: '2026-08-25' },
], '2026-09');
assert.equal(carryOver, 1350, 'O saldo residual do mês anterior deve considerar apenas valores realizados');

assert.equal(shiftRecurringDate('2027-01-31', 1), '2027-02-28');
assert.equal(shiftRecurringDate('2028-01-31', 1), '2028-02-29');
assert.equal(shiftRecurringDate('2026-03-31', 1), '2026-04-30');
assert.equal(shiftRecurringDate('2026-12-15', 1), '2027-01-15');

const twelveMonths = Array.from({ length: 12 }, (_, index) => shiftRecurringDate('2026-09-30', index));
assert.equal(twelveMonths.length, 12);
assert.equal(twelveMonths[0], '2026-09-30');
assert.equal(twelveMonths[11], '2027-08-30');

console.log('Cálculos financeiros e recorrências verificados com sucesso.');

