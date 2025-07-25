"use client"

import { useState, useEffect } from "react"
import type { Publication } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ArrowLeftIcon,
  FileTextIcon,
  NewspaperIcon,
  BuildingIcon,
  BookIcon,
  ExternalLinkIcon,
  CheckCircleIcon,
  ArrowRightLeftIcon as ArrowsRightLeftIcon,
  PercentIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

// Use a regular anchor tag for back button to force a full page reload
function BackButton() {
  return (
    <a href="/?preserveResults=true" className="inline-block">
      <Button variant="outline" className="mb-4">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />
        Back to Search
      </Button>
    </a>
  )
}

// Simple function to clean text - not a component
function getCleanText(text?: string): string {
  if (!text) return "No abstract available"

  // Just return the text with minimal processing
  return text.replace(/<[^>]*>/g, "")
}

export function CompareContent({
  sourceDoi,
  matchDoi,
  confidenceLevel,
}: {
  sourceDoi: string
  matchDoi: string
  confidenceLevel: string
}) {
  const [sourcePublication, setSourcePublication] = useState<Publication | null>(null)
  const [matchPublication, setMatchPublication] = useState<Publication | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function fetchPublications() {
      try {
        const response = await fetch(
          `/api/publication?doi=${encodeURIComponent(sourceDoi)}&matchDoi=${encodeURIComponent(matchDoi)}`,
        )

        if (!response.ok) {
          throw new Error(`Error fetching publications: ${response.status}`)
        }

        const data = await response.json()

        if (isMounted) {
          setSourcePublication(data.source)
          setMatchPublication(data.match)
          setLoading(false)
        }
      } catch (err) {
        console.error("Error fetching publications:", err)
        if (isMounted) {
          setError("Failed to load publication details")
          setLoading(false)
        }
      }
    }

    fetchPublications()

    return () => {
      isMounted = false
    }
  }, [sourceDoi, matchDoi])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <BackButton />
          <Card className="bg-destructive/10 text-destructive">
            <CardContent className="p-6">
              <p>{error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <BackButton />

        <h1 className="text-2xl font-bold mb-6">Publication Comparison</h1>

        <Card className="mb-6 bg-slate-50 dark:bg-slate-900">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <ArrowsRightLeftIcon className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold">Match Details</h2>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <PercentIcon className="h-4 w-4 text-blue-500" />
                <p>
                  <span className="font-medium">Confidence Level:</span> {confidenceLevel}
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                {confidenceLevel === "Very High"
                  ? "This match was found using explicit links in CrossRef metadata, indicating a direct relationship between the preprint and published article."
                  : confidenceLevel === "High"
                    ? "This match was determined based on high similarity between titles and authors of both publications."
                    : confidenceLevel === "Medium"
                      ? "This match was determined based on moderate similarity between titles and authors, but may require verification."
                      : "This match was determined based on available metadata. The confidence level indicates how likely these publications are related."}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Source Publication */}
          {sourcePublication && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  {sourcePublication.type === "preprint" ? (
                    <FileTextIcon className="h-5 w-5 text-orange-500" />
                  ) : (
                    <NewspaperIcon className="h-5 w-5 text-blue-500" />
                  )}
                  <CardTitle className="text-xl">
                    {sourcePublication.type === "preprint" ? (
                      <Badge
                        variant="outline"
                        className="bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800"
                      >
                        Preprint
                      </Badge>
                    ) : sourcePublication.type === "article" ? (
                      <Badge
                        variant="outline"
                        className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
                      >
                        Published Article
                      </Badge>
                    ) : (
                      <Badge variant="outline">Unknown</Badge>
                    )}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <h2 className="text-xl font-semibold">{sourcePublication.title}</h2>

                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Authors:</span> {sourcePublication.authors.join(", ")}
                  </p>

                  {sourcePublication.doi && (
                    <p className="flex items-center gap-1">
                      <span className="font-medium">DOI:</span>{" "}
                      <a
                        href={`https://doi.org/${sourcePublication.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        {sourcePublication.doi}
                        <ExternalLinkIcon className="h-3 w-3" />
                      </a>
                    </p>
                  )}

                  {sourcePublication.publicationDate && (
                    <p>
                      <span className="font-medium">Publication Date:</span> {sourcePublication.publicationDate}
                    </p>
                  )}

                  {sourcePublication.publisher && (
                    <p className="flex items-center gap-1">
                      <BookIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">Publisher:</span> {sourcePublication.publisher}
                    </p>
                  )}

                  {sourcePublication.type === "preprint" && sourcePublication.institution && (
                    <p className="flex items-center gap-1">
                      <BuildingIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">Preprint Server:</span> {sourcePublication.institution}
                    </p>
                  )}

                  {sourcePublication.type === "article" && sourcePublication.containerTitle && (
                    <p className="flex items-center gap-1">
                      <BookIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">Journal:</span> {sourcePublication.containerTitle}
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2">Abstract</h3>
                  <div className="text-sm bg-muted/50 p-4 rounded-md">
                    <div className="whitespace-pre-line">
                      {sourcePublication.abstract ? getCleanText(sourcePublication.abstract) : "No abstract available"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Match Publication */}
          {matchPublication && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  {matchPublication.type === "preprint" ? (
                    <FileTextIcon className="h-5 w-5 text-orange-500" />
                  ) : (
                    <NewspaperIcon className="h-5 w-5 text-blue-500" />
                  )}
                  <CardTitle className="text-xl">
                    {matchPublication.type === "preprint" ? (
                      <Badge
                        variant="outline"
                        className="bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800"
                      >
                        Preprint
                      </Badge>
                    ) : matchPublication.type === "article" ? (
                      <Badge
                        variant="outline"
                        className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
                      >
                        Published Article
                      </Badge>
                    ) : (
                      <Badge variant="outline">Unknown</Badge>
                    )}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <h2 className="text-xl font-semibold">{matchPublication.title}</h2>

                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Authors:</span> {matchPublication.authors.join(", ")}
                  </p>

                  {matchPublication.doi && (
                    <p className="flex items-center gap-1">
                      <span className="font-medium">DOI:</span>{" "}
                      <a
                        href={`https://doi.org/${matchPublication.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        {matchPublication.doi}
                        <ExternalLinkIcon className="h-3 w-3" />
                      </a>
                    </p>
                  )}

                  {matchPublication.publicationDate && (
                    <p>
                      <span className="font-medium">Publication Date:</span> {matchPublication.publicationDate}
                    </p>
                  )}

                  {matchPublication.publisher && (
                    <p className="flex items-center gap-1">
                      <BookIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">Publisher:</span> {matchPublication.publisher}
                    </p>
                  )}

                  {matchPublication.type === "preprint" && matchPublication.institution && (
                    <p className="flex items-center gap-1">
                      <BuildingIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">Preprint Server:</span> {matchPublication.institution}
                    </p>
                  )}

                  {matchPublication.type === "article" && matchPublication.containerTitle && (
                    <p className="flex items-center gap-1">
                      <BookIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">Journal:</span> {matchPublication.containerTitle}
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2">Abstract</h3>
                  <div className="text-sm bg-muted/50 p-4 rounded-md">
                    <div className="whitespace-pre-line">
                      {matchPublication.abstract ? getCleanText(matchPublication.abstract) : "No abstract available"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="mt-8 flex justify-center">
          <Button className="bg-green-600 hover:bg-green-700">
            <CheckCircleIcon className="mr-2 h-4 w-4" />
            Confirm This Match
          </Button>
        </div>
      </div>
    </div>
  )
}
