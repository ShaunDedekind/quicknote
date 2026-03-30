import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trip, TripBalance, User } from "@/lib/types"
import { formatCurrency } from "@/lib/balance"
import { ChevronRight } from "lucide-react"

interface TripCardProps {
  trip: Trip
  balances: TripBalance[]
  users: User[]
  totalSpent: number
  currency: string
}

export function TripCard({ trip, balances, users, totalSpent, currency }: TripCardProps) {
  const getUserName = (id: string | null) => users.find((u) => u.id === id)?.name ?? "Unknown"

  const nonZero = balances.filter((b) => b.net > 0.005)
  const isSquare = nonZero.length === 0

  return (
    <Link href={`/trips/${trip.id}`}>
      <Card className="hover:border-primary/40 transition-colors cursor-pointer">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{trip.name}</p>
            {trip.description && (
              <p className="text-sm text-muted-foreground truncate">{trip.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              Total: {formatCurrency(totalSpent, currency as import("@/lib/types").Currency ?? "NZD")}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isSquare ? (
              <Badge variant="success">Square</Badge>
            ) : (
              <div className="text-right">
                {nonZero.map((b) => (
                  <p key={b.currency} className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    {getUserName(b.owedBy)} owes {formatCurrency(b.net, b.currency)}
                  </p>
                ))}
              </div>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
