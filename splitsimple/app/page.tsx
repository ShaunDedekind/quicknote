import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { NavBar } from "@/components/NavBar"
import { BalanceSummary } from "@/components/BalanceSummary"
import { TripCard } from "@/components/TripCard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createServerClient } from "@/lib/supabase/server"
import { syncUser, getAllUsers } from "@/lib/user-sync"
import { calculateTripBalance } from "@/lib/balance"
import { Expense, ExpenseSplit, Settlement, Trip, TripBalance } from "@/lib/types"
import { Plus } from "lucide-react"

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const clerkUser = await currentUser()
  if (!clerkUser) redirect("/sign-in")

  // Sync user on first login
  await syncUser(
    userId,
    clerkUser.fullName ?? clerkUser.firstName ?? "User",
    clerkUser.emailAddresses[0]?.emailAddress ?? "",
  )

  const supabase = createServerClient()
  const users = await getAllUsers()

  // Fetch all trips with their expenses and settlements for balance calculation
  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .order("created_at", { ascending: false })

  const tripsData = (trips ?? []) as Trip[]

  if (tripsData.length === 0) {
    return (
      <div className="flex flex-col min-h-screen">
        <NavBar />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
          <div className="text-center py-16 space-y-4">
            <h1 className="text-2xl font-bold">Welcome to SplitSimple</h1>
            <p className="text-muted-foreground">Track shared expenses between Shaun & Rosie.</p>
            <Button asChild>
              <Link href="/trips/new">
                <Plus className="h-4 w-4" />
                Create your first trip
              </Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // Calculate per-trip balances and overall balance
  type TripSummary = {
    trip: Trip
    balances: TripBalance[]
    totalSpent: number
    currency: string
  }

  const tripSummaries: TripSummary[] = []
  const allExpenses: (Expense & { splits: ExpenseSplit[] })[] = []
  const allSettlements: Settlement[] = []

  for (const trip of tripsData) {
    const { data: expenses } = await supabase
      .from("expenses")
      .select("*, splits:expense_splits(*)")
      .eq("trip_id", trip.id)

    const { data: settlements } = await supabase
      .from("settlements")
      .select("*")
      .eq("trip_id", trip.id)

    const tripExpenses = (expenses ?? []) as (Expense & { splits: ExpenseSplit[] })[]
    const tripSettlements = (settlements ?? []) as Settlement[]

    allExpenses.push(...tripExpenses)
    allSettlements.push(...tripSettlements)

    const totalSpent = tripExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
    const primaryCurrency = tripExpenses[0]?.currency ?? "NZD"

    const user1 = users[0]
    const user2 = users[1]
    const balances =
      user1 && user2
        ? calculateTripBalance(tripExpenses, tripSettlements, user1.id, user2.id)
        : []

    tripSummaries.push({ trip, balances, totalSpent, currency: primaryCurrency })
  }

  const user1 = users[0]
  const user2 = users[1]
  const overallBalances =
    user1 && user2 ? calculateTripBalance(allExpenses, allSettlements, user1.id, user2.id) : []

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-6">
        {/* Overall balance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Overall Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <BalanceSummary balances={overallBalances} users={users} />
          </CardContent>
        </Card>

        {/* Trips list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Trips</h2>
            <Button asChild size="sm" variant="outline">
              <Link href="/trips/new">
                <Plus className="h-4 w-4" />
                New
              </Link>
            </Button>
          </div>
          {tripSummaries.map(({ trip, balances, totalSpent, currency }) => (
            <TripCard
              key={trip.id}
              trip={trip}
              balances={balances}
              users={users}
              totalSpent={totalSpent}
              currency={currency}
            />
          ))}
        </div>
      </main>
    </div>
  )
}
