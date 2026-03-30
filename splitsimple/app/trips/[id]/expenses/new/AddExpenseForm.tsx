"use client"

import { useState, useTransition, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SplitInput } from "@/components/SplitInput"
import { createExpense } from "@/lib/actions"
import { Currency, SplitType, User } from "@/lib/types"

const CURRENCIES: Currency[] = ["NZD", "AUD", "USD", "EUR", "GBP", "JPY"]

interface AddExpenseFormProps {
  tripId: string
  users: User[]
}

export function AddExpenseForm({ tripId, users }: AddExpenseFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState<Currency>("NZD")
  const [paidBy, setPaidBy] = useState(users[0]?.id ?? "")
  const [splitType, setSplitType] = useState<SplitType>("equal")
  const [splits, setSplits] = useState<{ userId: string; amount: number }[]>([])
  const [notes, setNotes] = useState("")

  const handleSplitsChange = useCallback((s: { userId: string; amount: number }[]) => {
    setSplits(s)
  }, [])

  const totalAmount = parseFloat(amount) || 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!description.trim()) {
      setError("Description is required")
      return
    }
    if (totalAmount <= 0) {
      setError("Amount must be greater than 0")
      return
    }
    if (!paidBy) {
      setError("Select who paid")
      return
    }

    // Validate splits
    if (splitType !== "equal") {
      const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0)
      if (Math.abs(splitTotal - totalAmount) > 0.01) {
        setError(`Split amounts must sum to ${totalAmount.toFixed(2)} (currently ${splitTotal.toFixed(2)})`)
        return
      }
    }

    const finalSplits =
      splitType === "equal"
        ? users.map((u) => ({ userId: u.id, amount: totalAmount / users.length }))
        : splits

    if (finalSplits.length === 0) {
      setError("Split is required")
      return
    }

    startTransition(async () => {
      try {
        await createExpense({
          tripId,
          description: description.trim(),
          amount: totalAmount,
          currency,
          paidBy,
          splits: finalSplits,
          notes: notes.trim() || null,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save expense")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Dinner at Depot"
          required
          autoFocus
        />
      </div>

      {/* Amount + Currency */}
      <div className="flex gap-3">
        <div className="flex-1 space-y-2">
          <Label htmlFor="amount">Amount *</Label>
          <Input
            id="amount"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        <div className="w-28 space-y-2">
          <Label>Currency</Label>
          <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
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

      {/* Paid by */}
      <div className="space-y-2">
        <Label>Paid by *</Label>
        <Select value={paidBy} onValueChange={setPaidBy}>
          <SelectTrigger>
            <SelectValue placeholder="Select person" />
          </SelectTrigger>
          <SelectContent>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Split type */}
      <div className="space-y-3">
        <Label>Split</Label>
        <div className="flex rounded-md border border-border overflow-hidden">
          {(["equal", "percentage", "amount"] as SplitType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSplitType(type)}
              className={`flex-1 py-2 text-sm font-medium transition-colors capitalize ${
                splitType === type
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground hover:bg-muted"
              }`}
            >
              {type === "equal" ? "Equal" : type === "percentage" ? "%" : "Amount"}
            </button>
          ))}
        </div>
        <SplitInput
          users={users}
          totalAmount={totalAmount}
          splitType={splitType}
          onChange={handleSplitsChange}
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any extra details…"
          rows={2}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Saving…" : "Save Expense"}
      </Button>
    </form>
  )
}
