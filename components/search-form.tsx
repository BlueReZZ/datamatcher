"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { SearchIcon, ArrowRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { SearchResults } from "@/components/search-results"
import { searchArticles } from "@/lib/search-service"
import type { ArticleMatch } from "@/lib/types"

// Example searches to display
const EXAMPLE_SEARCH_GROUPS = [
  {
    label: "Very High Confidence matches",
    examples: [
      "Synthetic eco-evolutionary dynamics in simple molecular environment",
      "A weakly structured stem for human origins in Africa",
      "Oncogenic RAS Induces a Distinctive Form of Non-Canonical Autophagy Mediated by the P38-ULK1-PI4KB Axis",
    ],
  },
  {
    label: "Data mapping",
    examples: [
      "Zinc finger homeobox-3 (ZFHX3) orchestrates genome-wide daily gene expression in the suprachiasmatic nucleus",
      "High resolution deep mutational scanning of the melanocortin-4 receptor enables target characterization for drug discovery",
    ],
  },
  {
    label: "Medium match results",
    examples: [
      "The genus Cortinarius should not (yet) be split",
      "Social state alters vision using three circuit mechanisms in Drosophila",
      "The E3 ubiquitin ligase mechanism specifying target-directed microRNA degradation",
      "Nuclear envelope budding is a non-canonical mechanism to export large transcripts in muscle cells",
    ],
  },
  {
    label: "Preprint elsewhere",
    examples: ["Ancient genomes from Ladakh reveal 2800-year-old mixture between Tibetans and South Asians"],
  },
]

export function SearchForm() {
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<ArticleMatch[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Check if we're returning from the comparison page
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const preserveResults = searchParams.get("preserveResults")

    if (preserveResults === "true" && sessionStorage.getItem("lastSearchResults")) {
      try {
        const savedResults = JSON.parse(sessionStorage.getItem("lastSearchResults") || "")
        const savedQuery = sessionStorage.getItem("lastSearchQuery") || ""

        if (savedResults && savedResults.length > 0) {
          setResults(savedResults)
          setQuery(savedQuery)
        }
      } catch (e) {
        console.error("Error restoring search results:", e)
      }
    }
  }, [])

  // Update the handleSearch function to save results to sessionStorage
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!query.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const searchResults = await searchArticles(query)
      setResults(searchResults)

      // Save results to sessionStorage
      sessionStorage.setItem("lastSearchResults", JSON.stringify(searchResults))
      sessionStorage.setItem("lastSearchQuery", query)

      if (!searchResults || searchResults.length === 0) {
        setError("No matches found. Try a different search term.")
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

  // Function to perform a search with a specific query
  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const searchResults = await searchArticles(searchQuery)
      setResults(searchResults)

      // Save results to sessionStorage
      sessionStorage.setItem("lastSearchResults", JSON.stringify(searchResults))
      sessionStorage.setItem("lastSearchQuery", searchQuery)

      if (!searchResults || searchResults.length === 0) {
        setError("No matches found. Try a different search term.")
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

  // Function to handle example search click
  const handleExampleClick = (exampleQuery: string) => {
    // Update the input field
    setQuery(exampleQuery)

    // Perform search with the example query directly
    performSearch(exampleQuery)
  }

  const handleClearSearch = () => {
    setQuery("")
    setResults(null)
    setError(null)
    setIsLoading(false)
    sessionStorage.removeItem("lastSearchResults")
    sessionStorage.removeItem("lastSearchQuery")
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSearch} className="space-y-6" data-search-form="true">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Search for a preprint or article</h2>
          <p className="text-sm text-muted-foreground">
            Enter the title or author names to find matching preprints or published articles
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Enter article/preprint title or author(s)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
            data-testid="search-input"
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
          <Button
            type="button"
            onClick={handleClearSearch}
            variant="outline"
            disabled={isLoading || (!query && !results && !error)}
          >
            Clear
          </Button>
        </div>

        {/* Example searches */}
        <div className="space-y-4">
          <p className="text-sm font-medium text-muted-foreground">Try an example:</p>
          {EXAMPLE_SEARCH_GROUPS.map((group) => (
            <div key={group.label} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{group.label}</p>
              <div className="flex flex-col space-y-2">
                {group.examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => handleExampleClick(example)}
                    className="text-sm text-primary hover:text-primary/80 hover:underline flex items-center"
                  >
                    <ArrowRightIcon className="h-3 w-3 mr-1" />
                    <span>{example}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </form>

      {error && <div className="mt-6 text-center p-4 bg-destructive/10 text-destructive rounded-md">{error}</div>}

      {results && !error && <SearchResults results={results} />}
    </Card>
  )
}
