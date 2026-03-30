import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { NavBar } from "@/components/NavBar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createTrip } from "@/lib/actions"
import { ArrowLeft } from "lucide-react"

export default async function NewTripPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Button asChild variant="ghost" size="icon">
            <Link href="/trips">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-bold">New Trip</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trip Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createTrip} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Trip name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g. Queenstown Weekend"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="A few words about the trip…"
                  rows={3}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Both Shaun & Rosie will be added automatically.
              </p>
              <Button type="submit" className="w-full">
                Create Trip
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
