import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { NavBar } from "@/components/NavBar"
import { TripCard } from "@/components/TripCard"
import { Button } from "@/components/ui/button"
import { createServerClient } from "@/lib/supabase/server"
import { getAllUsers } from "@/lib/user-sync"
import { calculateTripBalance } from "@/lib/balance"
import { Expense, ExpenseSplit, Settlement, Trip } from "@/lib/types"
import { Plus } from "lucide-react"

export default async function TripsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const supabase = createServerClient()
  const users = await getAllUsers()

  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .order("created_at", { ascending: false })

  const tripsData = (trips ?? []) as Trip[]

  const summaries = await Promise.all(
    tripsData.map(async (trip) => {
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
      const totalSpent = tripExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
      const primaryCurrency = tripExpenses[0]?.currency ?? "NZD"

      const user1 = users[0]
      const user2 = users[1]
      const balances =
        user1 && user2
          ? calculateTripBalance(tripExpenses, tripSettlements, user1.id, user2.id)
          : []

      return { trip, balances, totalSpent, currency: primaryCurrency }
    }),
  )

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">All Trips</h1>
          <Button asChild size="sm">
            <Link href="/trips/new">
              <Plus className="h-4 w-4" />
              New Trip
            </Link>
          </Button>
        </div>

        {summaries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No trips yet.</p>
            <Button asChild className="mt-4">
              <Link href="/trips/new">Create your first trip</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {summaries.map(({ trip, balances, totalSpent, currency }) => (
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
        )}
      </main>
    </div>
  )
}
