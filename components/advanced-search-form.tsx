"use client"

import type React from "react"

import { useState } from "react"
import { SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { SearchResults } from "@/components/search-results"
import { searchArticlesAdvanced } from "@/lib/search-service"
import type { ArticleMatch } from "@/lib/types"

export function AdvancedSearchForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<ArticleMatch[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [funder, setFunder] = useState("")

  // Check if we're returning from the comparison page
  useState(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search)
      const preserveResults = searchParams.get("preserveResults")

      if (preserveResults === "true" && sessionStorage.getItem("lastSearchResults")) {
        try {
          const savedResults = JSON.parse(sessionStorage.getItem("lastSearchResults") || "")

          if (savedResults && savedResults.length > 0) {
            setResults(savedResults)

            // Try to restore form values if they were saved
            const savedFormValues = JSON.parse(sessionStorage.getItem("lastAdvancedSearchForm") || "{}")
            if (savedFormValues) {
              setTitle(savedFormValues.title || "")
              setAuthor(savedFormValues.author || "")
              setFunder(savedFormValues.funder || "")
            }
          }
        } catch (e) {
          console.error("Error restoring search results:", e)
        }
      }
    }
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate that at least one field has a value
    if (!title && !author && !funder) {
      setError("Please enter at least one search term")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const searchResults = await searchArticlesAdvanced({
        title,
        author,
        funderName: funder,
      })

      setResults(searchResults)

      // Save results to sessionStorage
      sessionStorage.setItem("lastSearchResults", JSON.stringify(searchResults))

      // Save form values
      sessionStorage.setItem(
        "lastAdvancedSearchForm",
        JSON.stringify({
          title,
          author,
          funder,
        }),
      )

      if (!searchResults || searchResults.length === 0) {
        setError("No matches found. Try different search terms.")
      }
    } catch (err) {
      console.error("Search error:", err)

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
          <h2 className="text-xl font-semibold">Advanced Search</h2>
          <p className="text-sm text-muted-foreground">Search for preprints or articles using specific fields</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Enter publication title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="author">Author</Label>
            <Input
              id="author"
              placeholder="Enter author name"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="funder">Funder</Label>
            <Input
              id="funder"
              placeholder="Enter funding organization"
              value={funder}
              onChange={(e) => setFunder(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end">
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
