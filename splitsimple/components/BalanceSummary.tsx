import { TripBalance, User } from "@/lib/types"
import { formatCurrency } from "@/lib/balance"
import { cn } from "@/lib/utils"

interface BalanceSummaryProps {
  balances: TripBalance[]
  users: User[]
  className?: string
}

export function BalanceSummary({ balances, users, className }: BalanceSummaryProps) {
  const getUserName = (id: string | null) => users.find((u) => u.id === id)?.name ?? "Unknown"

  const nonZero = balances.filter((b) => b.net > 0.005)

  if (nonZero.length === 0) {
    return (
      <div className={cn("text-center py-3", className)}>
        <p className="text-sm font-medium text-green-600 dark:text-green-400">You&apos;re all square ✓</p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-1", className)}>
      {nonZero.map((b) => (
        <p key={b.currency} className="text-sm font-medium text-amber-600 dark:text-amber-400">
          {getUserName(b.owedBy)} owes {getUserName(b.owedTo)}{" "}
          <span className="font-bold">{formatCurrency(b.net, b.currency)}</span>
        </p>
      ))}
    </div>
  )
}
