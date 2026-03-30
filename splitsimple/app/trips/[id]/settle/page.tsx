import { auth } from "@clerk/nextjs/server"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { NavBar } from "@/components/NavBar"
import { BalanceSummary } from "@/components/BalanceSummary"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createServerClient } from "@/lib/supabase/server"
import { getAllUsers } from "@/lib/user-sync"
import { calculateTripBalance } from "@/lib/balance"
import { createSettlement } from "@/lib/actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Expense, ExpenseSplit, Settlement, Trip, Currency } from "@/lib/types"
import { ArrowLeft } from "lucide-react"

const CURRENCIES: Currency[] = ["NZD", "AUD", "USD", "EUR", "GBP", "JPY"]

export default async function SettlePage({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: settlements } = await supabase
    .from("settlements")
    .select("*")
    .eq("trip_id", id)

  const tripExpenses = (expenses ?? []) as (Expense & { splits: ExpenseSplit[] })[]
  const tripSettlements = (settlements ?? []) as Settlement[]

  const user1 = users[0]
  const user2 = users[1]

  if (!user1 || !user2) {
    return (
      <div className="flex flex-col min-h-screen">
        <NavBar />
        <main className="max-w-lg mx-auto w-full px-4 py-6">
          <p className="text-muted-foreground">No users found.</p>
        </main>
      </div>
    )
  }

  const balances = calculateTripBalance(tripExpenses, tripSettlements, user1.id, user2.id)
  const nonZero = balances.filter((b) => b.net > 0.005)

  // Determine default settle direction
  const primaryBalance = nonZero[0]
  const defaultFromUser = primaryBalance?.owedBy ?? user2.id
  const defaultToUser = primaryBalance?.owedTo ?? user1.id
  const defaultAmount = primaryBalance ? primaryBalance.net.toFixed(2) : ""
  const defaultCurrency = primaryBalance?.currency ?? "NZD"

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href={`/trips/${id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-bold">Settle Up</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <BalanceSummary balances={balances} users={users} />
          </CardContent>
        </Card>

        {nonZero.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Nothing to settle — you&apos;re already square!</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href={`/trips/${id}`}>Back to trip</Link>
            </Button>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Record Settlement</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createSettlement} className="space-y-4">
                <input type="hidden" name="tripId" value={id} />
                <input type="hidden" name="fromUserId" value={defaultFromUser} />
                <input type="hidden" name="toUserId" value={defaultToUser} />

                <p className="text-sm text-muted-foreground">
                  {users.find((u) => u.id === defaultFromUser)?.name} pays{" "}
                  {users.find((u) => u.id === defaultToUser)?.name}
                </p>

                <div className="flex gap-3">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue={defaultAmount}
                      required
                    />
                  </div>
                  <div className="w-28 space-y-2">
                    <Label>Currency</Label>
                    <Select name="currency" defaultValue={defaultCurrency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="note">Note (optional)</Label>
                  <Textarea
                    id="note"
                    name="note"
                    placeholder="e.g. Bank transfer"
                    rows={2}
                  />
                </div>

                <Button type="submit" variant="success" className="w-full">
                  Record Settlement
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
