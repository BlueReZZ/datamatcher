import { BookOpenIcon } from "lucide-react"

export function HeroSection() {
  return (
    <div className="text-center space-y-4 w-full max-w-4xl">
      <div className="flex justify-center">
        <BookOpenIcon className="h-16 w-16 text-primary" />
      </div>
      <h1 className="text-4xl font-bold tracking-tight">Open Science Data Matcher</h1>
      <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
        Connect research outputs across the scholarly ecosystem using title, author, or identifier information.
      </p>
    </div>
  )
}
