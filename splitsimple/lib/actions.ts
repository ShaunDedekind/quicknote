"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createServerClient } from "./supabase/server"
import { getUserByClerkId } from "./user-sync"
import { Currency } from "./types"

async function requireUser() {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")
  const user = await getUserByClerkId(userId)
  if (!user) throw new Error("User not found — please sign out and sign back in")
  return user
}

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

export async function createTrip(formData: FormData) {
  const currentUser = await requireUser()
  const supabase = createServerClient()

  const name = (formData.get("name") as string).trim()
  const description = (formData.get("description") as string).trim() || null

  if (!name) throw new Error("Trip name is required")

  const { data: trip, error } = await supabase
    .from("trips")
    .insert({ name, description, created_by: currentUser.id })
    .select("id")
    .single()

  if (error) throw new Error(`Failed to create trip: ${error.message}`)

  // Add both users as members
  const { data: allUsers } = await supabase.from("users").select("id")
  if (allUsers && allUsers.length > 0) {
    await supabase.from("trip_members").insert(
      allUsers.map((u: { id: string }) => ({ trip_id: trip.id, user_id: u.id })),
    )
  }

  revalidatePath("/trips")
  redirect(`/trips/${trip.id}`)
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

interface CreateExpenseInput {
  tripId: string
  description: string
  amount: number
  currency: Currency
  paidBy: string
  splits: { userId: string; amount: number }[]
  notes: string | null
}

export async function createExpense(input: CreateExpenseInput) {
  await requireUser()
  const supabase = createServerClient()

  const { data: expense, error } = await supabase
    .from("expenses")
    .insert({
      trip_id: input.tripId,
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      paid_by: input.paidBy,
      notes: input.notes,
    })
    .select("id")
    .single()

  if (error) throw new Error(`Failed to create expense: ${error.message}`)

  const { error: splitError } = await supabase.from("expense_splits").insert(
    input.splits.map((s) => ({
      expense_id: expense.id,
      user_id: s.userId,
      amount: s.amount,
    })),
  )

  if (splitError) throw new Error(`Failed to create splits: ${splitError.message}`)

  revalidatePath(`/trips/${input.tripId}`)
  redirect(`/trips/${input.tripId}`)
}

// ---------------------------------------------------------------------------
// Settlements
// ---------------------------------------------------------------------------

export async function createSettlement(formData: FormData) {
  const currentUser = await requireUser()
  const supabase = createServerClient()

  const tripId = formData.get("tripId") as string
  const fromUserId = formData.get("fromUserId") as string
  const toUserId = formData.get("toUserId") as string
  const amount = parseFloat(formData.get("amount") as string)
  const currency = formData.get("currency") as Currency
  const note = (formData.get("note") as string).trim() || null

  if (!tripId || !fromUserId || !toUserId || isNaN(amount) || amount <= 0) {
    throw new Error("Invalid settlement data")
  }

  const { error } = await supabase.from("settlements").insert({
    trip_id: tripId,
    from_user: fromUserId,
    to_user: toUserId,
    amount,
    currency,
    note,
  })

  if (error) throw new Error(`Failed to record settlement: ${error.message}`)

  revalidatePath(`/trips/${tripId}`)
  redirect(`/trips/${tripId}`)
}
