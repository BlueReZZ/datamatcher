import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "lucide-react"

export default function ConfirmMatchPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-md mx-auto">
        <a href="/" className="inline-block mb-4">
          <Button variant="outline">
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            Back to Search
          </Button>
        </a>

        <Card>
          <CardHeader>
            <CardTitle>Confirm Match</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">This page is for confirming matches between preprints and published articles.</p>
            <p className="text-muted-foreground text-sm">
              To use this functionality, please start from the search page and select a match to confirm.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
