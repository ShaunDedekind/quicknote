export type Currency = "NZD" | "AUD" | "USD" | "EUR" | "GBP" | "JPY"

export interface User {
  id: string
  clerk_id: string
  name: string
  email: string
  created_at: string
}

export interface Trip {
  id: string
  name: string
  description: string | null
  created_by: string | null
  created_at: string
}

export interface TripMember {
  trip_id: string
  user_id: string
}

export interface Expense {
  id: string
  trip_id: string
  description: string
  amount: number
  currency: Currency
  paid_by: string | null
  created_at: string
  notes: string | null
}

export interface ExpenseSplit {
  id: string
  expense_id: string
  user_id: string | null
  amount: number
}

export interface Settlement {
  id: string
  trip_id: string
  from_user: string | null
  to_user: string | null
  amount: number
  currency: Currency
  note: string | null
  settled_at: string
}

export interface ExpenseWithSplits extends Expense {
  splits: ExpenseSplit[]
  payer: User | null
}

export interface TripWithMembers extends Trip {
  members: User[]
}

export type SplitType = "equal" | "percentage" | "amount"

export interface BalanceEntry {
  owedBy: string
  owedTo: string
  amount: number
  currency: Currency
}

export interface TripBalance {
  currency: Currency
  /** Positive: shaun is owed. Negative: rosie is owed */
  net: number
  owedBy: string | null
  owedTo: string | null
}
