import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { NavBar } from "@/components/NavBar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAllUsers } from "@/lib/user-sync"
import { ArrowLeft } from "lucide-react"
import { AddExpenseForm } from "./AddExpenseForm"

export default async function NewExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const { id } = await params
  const users = await getAllUsers()

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Button asChild variant="ghost" size="icon">
            <Link href={`/trips/${id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-bold">Add Expense</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense Details</CardTitle>
          </CardHeader>
          <CardContent>
            <AddExpenseForm tripId={id} users={users} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
