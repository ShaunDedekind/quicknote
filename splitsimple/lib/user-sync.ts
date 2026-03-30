"use server"

import { createServerClient } from "./supabase/server"
import { User } from "./types"

/**
 * Ensures a Supabase user row exists for the given Clerk user.
 * Creates one if it doesn't exist. Returns the user row.
 */
export async function syncUser(clerkId: string, name: string, email: string): Promise<User> {
  const supabase = createServerClient()

  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("clerk_id", clerkId)
    .single()

  if (existing) return existing as User

  const { data, error } = await supabase
    .from("users")
    .insert({ clerk_id: clerkId, name, email })
    .select("*")
    .single()

  if (error) throw new Error(`Failed to sync user: ${error.message}`)
  return data as User
}

/**
 * Get the Supabase user row for the given Clerk user ID.
 */
export async function getUserByClerkId(clerkId: string): Promise<User | null> {
  const supabase = createServerClient()
  const { data } = await supabase.from("users").select("*").eq("clerk_id", clerkId).single()
  return (data as User) ?? null
}

/**
 * Get all users (for Shaun & Rosie MVP — just two users).
 */
export async function getAllUsers(): Promise<User[]> {
  const supabase = createServerClient()
  const { data } = await supabase.from("users").select("*").order("created_at")
  return (data as User[]) ?? []
}
