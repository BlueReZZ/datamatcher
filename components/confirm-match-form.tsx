"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircleIcon, LoaderIcon } from "lucide-react"
import { confirmMatch } from "@/app/compare/confirm-action"

interface ConfirmMatchFormProps {
  sourceDoi: string
  matchDoi: string
}

export function ConfirmMatchForm({ sourceDoi, matchDoi }: ConfirmMatchFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useServerAction, setUseServerAction] = useState(false)

  const handleClientSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      // Instead of using fetch and dealing with response parsing,
      // directly navigate to the research network page with enhanced mode enabled
      window.location.href = `/research-network?anchor=${encodeURIComponent(sourceDoi)}&related=${encodeURIComponent(matchDoi)}&useMatching=true`

      // No need to set isSubmitting to false as we're navigating away
    } catch (err) {
      console.error("Error navigating:", err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
      setIsSubmitting(false)
    }
  }

  const switchToServerAction = () => {
    setUseServerAction(true)
  }

  return (
    <div className="mt-8 flex flex-col items-center">
      {useServerAction ? (
        <form action={confirmMatch} className="flex flex-col items-center">
          <input type="hidden" name="sourceDoi" value={sourceDoi} />
          <input type="hidden" name="matchDoi" value={matchDoi} />
          <Button type="submit" className="bg-green-600 hover:bg-green-700">
            <CheckCircleIcon className="mr-2 h-4 w-4" />
            Confirm This Match (Server Action)
          </Button>
        </form>
      ) : (
        <div className="flex flex-col items-center">
          <Button onClick={handleClientSubmit} className="bg-green-600 hover:bg-green-700" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                Confirming...
              </>
            ) : (
              <>
                <CheckCircleIcon className="mr-2 h-4 w-4" />
                Confirm This Match
              </>
            )}
          </Button>

          {error && (
            <div className="mt-4 text-center space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" onClick={switchToServerAction}>
                  Try Server Action Instead
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
