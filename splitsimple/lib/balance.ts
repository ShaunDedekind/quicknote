import { Currency, Expense, ExpenseSplit, Settlement, TripBalance } from "./types"

interface ExpenseWithSplitsRaw {
  id: string
  paid_by: string | null
  currency: Currency
  splits: ExpenseSplit[]
}

/**
 * Calculate the net balance for a trip.
 *
 * For each expense:
 *   - The payer is owed the split amounts by all other users
 *   - i.e. if Shaun paid $100 split 60/40, Rosie owes Shaun $40
 *
 * Settlements offset the balance.
 *
 * Returns balances grouped by currency.
 */
export function calculateTripBalance(
  expenses: ExpenseWithSplitsRaw[],
  settlements: Settlement[],
  userId1: string,
  userId2: string,
): TripBalance[] {
  // Track net[currency][owerId] = amount they owe userId1
  const debts: Record<string, Record<string, number>> = {}

  for (const expense of expenses) {
    if (!expense.paid_by) continue
    const { paid_by, currency, splits } = expense

    if (!debts[currency]) debts[currency] = {}

    for (const split of splits) {
      if (!split.user_id || split.user_id === paid_by) continue

      const debtor = split.user_id
      if (!debts[currency][debtor]) debts[currency][debtor] = 0
      debts[currency][debtor] += Number(split.amount)
    }
  }

  // Apply settlements: from_user paid to_user, so reduces from_user's debt to to_user
  for (const s of settlements) {
    const { from_user, to_user, currency, amount } = s
    if (!from_user || !to_user) continue
    if (!debts[currency]) debts[currency] = {}
    if (!debts[currency][from_user]) debts[currency][from_user] = 0
    debts[currency][from_user] -= Number(amount)
  }

  const result: TripBalance[] = []
  const currencies = new Set([
    ...expenses.map((e) => e.currency),
    ...settlements.map((s) => s.currency),
  ])

  for (const currency of currencies) {
    const currencyDebts = debts[currency] ?? {}

    // Net from user2's perspective: positive means user2 owes user1
    const user2Owes = currencyDebts[userId2] ?? 0
    const user1Owes = currencyDebts[userId1] ?? 0
    const net = user2Owes - user1Owes

    if (Math.abs(net) < 0.005) {
      result.push({ currency: currency as Currency, net: 0, owedBy: null, owedTo: null })
    } else if (net > 0) {
      result.push({ currency: currency as Currency, net, owedBy: userId2, owedTo: userId1 })
    } else {
      result.push({ currency: currency as Currency, net: Math.abs(net), owedBy: userId1, owedTo: userId2 })
    }
  }

  return result
}

export function formatCurrency(amount: number, currency: Currency): string {
  const formatter = new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return formatter.format(amount)
}
