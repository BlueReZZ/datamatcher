"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { SearchResults } from "@/components/search-results"
import { searchByOrcid } from "@/lib/search-service"
import type { ArticleMatch } from "@/lib/types"

export function OrcidSearchForm() {
  const [orcid, setOrcid] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<ArticleMatch[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Check if we're returning from the comparison page
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const preserveResults = searchParams.get("preserveResults")

    if (preserveResults === "true" && sessionStorage.getItem("lastOrcidSearchResults")) {
      try {
        const savedResults = JSON.parse(sessionStorage.getItem("lastOrcidSearchResults") || "")
        const savedOrcid = sessionStorage.getItem("lastOrcidQuery") || ""

        if (savedResults && savedResults.length > 0) {
          setResults(savedResults)
          setOrcid(savedOrcid)
        }
      } catch (e) {
        console.error("Error restoring ORCID search results:", e)
      }
    }
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    // Basic ORCID validation
    const orcidPattern = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/
    if (!orcid.trim() || !orcidPattern.test(orcid)) {
      setError("Please enter a valid ORCID (format: 0000-0000-0000-0000)")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const searchResults = await searchByOrcid(orcid)
      setResults(searchResults)

      // Save results to sessionStorage
      sessionStorage.setItem("lastOrcidSearchResults", JSON.stringify(searchResults))
      sessionStorage.setItem("lastOrcidQuery", orcid)

      if (!searchResults || searchResults.length === 0) {
        setError("No publications found for this ORCID. Please check the ORCID and try again.")
      }
    } catch (err) {
      console.error("ORCID search error:", err)

      // Extract error message if available
      let errorMessage = "An error occurred while searching. Please try again."

      if (err instanceof Error) {
        errorMessage = err.message
      }

      if (errorMessage.includes("OpenAI API key")) {
        errorMessage =
          "LLM-based matching is unavailable. Only basic matching is being used. Please configure the OpenAI API key for advanced matching."
      } else if (errorMessage.includes("CrossRef API")) {
        errorMessage = "Error connecting to CrossRef API. Please try again later."
      }

      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSearch} className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Search Your Content by ORCID</h2>
          <p className="text-sm text-muted-foreground">
            Enter your ORCID identifier to find all your publications and potential preprint-article matches
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="ORCID (e.g., 0000-0000-0000-0000)"
            value={orcid}
            onChange={(e) => setOrcid(e.target.value)}
            className="flex-1"
            pattern="\d{4}-\d{4}-\d{4}-\d{3}[\dX]"
            title="Please enter a valid ORCID (format: 0000-0000-0000-0000)"
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Searching...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <SearchIcon className="h-4 w-4" />
                Search
              </span>
            )}
          </Button>
        </div>
      </form>

      {error && <div className="mt-6 text-center p-4 bg-destructive/10 text-destructive rounded-md">{error}</div>}

      {results && !error && <SearchResults results={results} />}
    </Card>
  )
}
