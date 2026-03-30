import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export function NavBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">
          SplitSimple
        </Link>
        <div className="flex items-center gap-3">
          <Button asChild size="sm" variant="outline">
            <Link href="/trips/new">
              <Plus className="h-4 w-4" />
              New Trip
            </Link>
          </Button>
          <UserButton />
        </div>
      </div>
    </header>
  )
}
