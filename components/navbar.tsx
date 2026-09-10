import Link from "next/link"
import { BookOpenIcon } from "lucide-react"
import packageJson from "@/package.json"

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/" className="flex items-center space-x-2 text-primary">
            <BookOpenIcon className="h-6 w-6" />
            <span className="font-semibold text-foreground">Open Science Data Matcher</span>
            <span className="text-xs text-muted-foreground">v{packageJson.version}</span>
          </Link>
        </div>
      </div>
    </header>
  )
}
