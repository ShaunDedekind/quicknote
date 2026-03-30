"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { SplitType, User } from "@/lib/types"
import { cn } from "@/lib/utils"

interface SplitInputProps {
  users: User[]
  totalAmount: number
  splitType: SplitType
  onChange: (splits: { userId: string; amount: number }[]) => void
}

export function SplitInput({ users, totalAmount, splitType, onChange }: SplitInputProps) {
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    if (splitType === "equal" && users.length === 2) {
      const half = totalAmount / 2
      const splits = users.map((u) => ({ userId: u.id, amount: half }))
      onChange(splits)
    }
  }, [splitType, totalAmount, users, onChange])

  if (splitType === "equal") {
    const half = totalAmount / 2
    return (
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between text-sm">
            <span>{u.name}</span>
            <span className="font-medium">{isNaN(half) ? "—" : `${(half).toFixed(2)}`}</span>
          </div>
        ))}
      </div>
    )
  }

  if (splitType === "percentage") {
    const handleChange = (userId: string, val: string) => {
      const updated = { ...values, [userId]: val }
      setValues(updated)
      const splits = users.map((u) => ({
        userId: u.id,
        amount: (totalAmount * (parseFloat(updated[u.id] ?? "0") / 100)) || 0,
      }))
      onChange(splits)
    }

    const total = users.reduce((sum, u) => sum + parseFloat(values[u.id] ?? "0"), 0)
    const valid = Math.abs(total - 100) < 0.01

    return (
      <div className="space-y-3">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3">
            <Label className="w-24 shrink-0">{u.name}</Label>
            <div className="flex items-center gap-1 flex-1">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="50"
                value={values[u.id] ?? ""}
                onChange={(e) => handleChange(u.id, e.target.value)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">%</span>
              <span className="text-sm text-muted-foreground ml-auto">
                = {isNaN(totalAmount) ? "—" : `${((totalAmount * parseFloat(values[u.id] ?? "0")) / 100).toFixed(2)}`}
              </span>
            </div>
          </div>
        ))}
        {!valid && (
          <p className="text-xs text-destructive">Percentages must sum to 100% (currently {total.toFixed(1)}%)</p>
        )}
      </div>
    )
  }

  // amount split
  const handleChange = (userId: string, val: string) => {
    const updated = { ...values, [userId]: val }
    setValues(updated)
    const splits = users.map((u) => ({
      userId: u.id,
      amount: parseFloat(updated[u.id] ?? "0") || 0,
    }))
    onChange(splits)
  }

  const total = users.reduce((sum, u) => sum + (parseFloat(values[u.id] ?? "0") || 0), 0)
  const valid = Math.abs(total - totalAmount) < 0.01

  return (
    <div className="space-y-3">
      {users.map((u) => (
        <div key={u.id} className="flex items-center gap-3">
          <Label className="w-24 shrink-0">{u.name}</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={values[u.id] ?? ""}
            onChange={(e) => handleChange(u.id, e.target.value)}
          />
        </div>
      ))}
      {!valid && totalAmount > 0 && (
        <p className="text-xs text-destructive">
          Amounts must sum to {totalAmount.toFixed(2)} (currently {total.toFixed(2)})
        </p>
      )}
    </div>
  )
}
