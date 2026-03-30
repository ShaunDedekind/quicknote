import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExpenseWithSplits, User } from "@/lib/types"
import { formatCurrency } from "@/lib/balance"

interface ExpenseCardProps {
  expense: ExpenseWithSplits
  users: User[]
}

export function ExpenseCard({ expense, users }: ExpenseCardProps) {
  const getUserName = (id: string | null) => users.find((u) => u.id === id)?.name ?? "Unknown"

  const date = new Date(expense.created_at).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
  })

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{expense.description}</p>
            <p className="text-sm text-muted-foreground">
              Paid by {getUserName(expense.paid_by)} · {date}
            </p>
            {expense.notes && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{expense.notes}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold">{formatCurrency(expense.amount, expense.currency)}</p>
            <Badge variant="outline" className="text-xs mt-1">
              {expense.currency}
            </Badge>
          </div>
        </div>
        {expense.splits.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border flex gap-4">
            {expense.splits.map((split) => (
              <div key={split.id} className="text-xs text-muted-foreground">
                <span className="font-medium">{getUserName(split.user_id)}</span>:{" "}
                {formatCurrency(split.amount, expense.currency)}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
