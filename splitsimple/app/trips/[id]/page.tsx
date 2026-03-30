import { auth } from "@clerk/nextjs/server"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { NavBar } from "@/components/NavBar"
import { BalanceSummary } from "@/components/BalanceSummary"
import { ExpenseCard } from "@/components/ExpenseCard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createServerClient } from "@/lib/supabase/server"
import { getAllUsers } from "@/lib/user-sync"
import { calculateTripBalance, formatCurrency } from "@/lib/balance"
import { Expense, ExpenseSplit, ExpenseWithSplits, Settlement, Trip } from "@/lib/types"
import { ArrowLeft, Plus, HandCoins } from "lucide-react"

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const { id } = await params
  const supabase = createServerClient()

  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).single()
  if (!trip) notFound()

  const users = await getAllUsers()

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*, splits:expense_splits(*)")
    .eq("trip_id", id)
    .order("created_at", { ascending: false })

  const { data: settlements } = await supabase
    .from("settlements")
    .select("*")
    .eq("trip_id", id)
    .order("settled_at", { ascending: false })

  const tripExpenses = (expenses ?? []) as (Expense & { splits: ExpenseSplit[] })[]
  const tripSettlements = (settlements ?? []) as Settlement[]

  const user1 = users[0]
  const user2 = users[1]
  const balances =
    user1 && user2
      ? calculateTripBalance(tripExpenses, tripSettlements, user1.id, user2.id)
      : []

  const totalSpent = tripExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const hasBalance = balances.some((b) => b.net > 0.005)

  const expensesWithSplits: ExpenseWithSplits[] = tripExpenses.map((e) => ({
    ...e,
    payer: users.find((u) => u.id === e.paid_by) ?? null,
  }))

  const primaryCurrency = tripExpenses[0]?.currency ?? "NZD"

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{(trip as Trip).name}</h1>
            {(trip as Trip).description && (
              <p className="text-sm text-muted-foreground truncate">{(trip as Trip).description}</p>
            )}
          </div>
        </div>

        {/* Summary */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total spent</span>
              <span className="font-semibold">
                {formatCurrency(totalSpent, primaryCurrency as import("@/lib/types").Currency)}
              </span>
            </div>
            <div className="border-t border-border pt-3">
              <BalanceSummary balances={balances} users={users} />
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button asChild className="flex-1">
            <Link href={`/trips/${id}/expenses/new`}>
              <Plus className="h-4 w-4" />
              Add Expense
            </Link>
          </Button>
          {hasBalance && (
            <Button asChild variant="outline" className="flex-1">
              <Link href={`/trips/${id}/settle`}>
                <HandCoins className="h-4 w-4" />
                Settle Up
              </Link>
            </Button>
          )}
        </div>

        {/* Expenses list */}
        <div className="space-y-3">
          <h2 className="font-semibold">Expenses</h2>
          {expensesWithSplits.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No expenses yet. Add the first one!
            </p>
          ) : (
            expensesWithSplits.map((expense) => (
              <ExpenseCard key={expense.id} expense={expense} users={users} />
            ))
          )}
        </div>

        {/* Settlements */}
        {tripSettlements.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold">Settlements</h2>
            {tripSettlements.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {users.find((u) => u.id === s.from_user)?.name ?? "?"} →{" "}
                      {users.find((u) => u.id === s.to_user)?.name ?? "?"}
                    </p>
                    {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
                  </div>
                  <p className="font-semibold text-green-600">
                    {formatCurrency(Number(s.amount), s.currency as import("@/lib/types").Currency)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
