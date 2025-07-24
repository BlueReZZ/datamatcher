import type { ArticleMatch, ConfidenceLevel, Publication } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  ExternalLinkIcon,
  ArrowRightIcon,
  FileTextIcon,
  NewspaperIcon,
  BuildingIcon,
  BookIcon,
  HelpCircleIcon,
  ArrowRightLeftIcon as ArrowsRightLeftIcon,
  NetworkIcon,
} from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { FormattedTitle } from "@/components/formatted-title"

interface SearchResultsProps {
  results: ArticleMatch[]
}

export function SearchResults({ results }: SearchResultsProps) {
  // Add this helper function at the top of the component
  const shouldDisableEnhancedMatching = (results: ArticleMatch[]) => {
    return results.some((match) => match.confidenceLevel === "Very High")
  }

  const getConfidenceBadge = (confidence: ConfidenceLevel) => {
    switch (confidence) {
      case "Very High":
        return <Badge className="bg-green-500 hover:bg-green-600">Very High Confidence</Badge>
      case "High":
        return <Badge className="bg-blue-500 hover:bg-blue-600">High Confidence</Badge>
      case "Medium":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Medium Confidence</Badge>
      case "Low":
        return <Badge className="bg-red-500 hover:bg-red-600">Low Confidence</Badge>
      default:
        return <Badge className="bg-gray-500 hover:bg-gray-600">Unknown Confidence</Badge>
    }
  }

  const getPublicationIcon = (type: string) => {
    if (type === "preprint") {
      return <FileTextIcon className="h-5 w-5 text-orange-500" />
    } else if (type === "article") {
      return <NewspaperIcon className="h-5 w-5 text-blue-500" />
    }
    return <HelpCircleIcon className="h-5 w-5 text-gray-500" />
  }

  const getPublicationBadge = (publication: Publication) => {
    if (publication.typeLabel) {
      // Use the type label if available
      return (
        <Badge
          variant="outline"
          className="bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800"
        >
          {publication.typeLabel}
        </Badge>
      )
    } else if (publication.type === "preprint") {
      return (
        <Badge
          variant="outline"
          className="bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800"
        >
          Preprint
        </Badge>
      )
    } else if (publication.type === "article") {
      return (
        <Badge
          variant="outline"
          className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
        >
          Published Article
        </Badge>
      )
    }
    return <Badge variant="outline">Unknown</Badge>
  }

  const PublicationDetails = ({ publication }: { publication: Publication }) => {
    // Check if we have a valid publication with title
    if (!publication || !publication.title || publication.title === "Unknown Title") {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <HelpCircleIcon className="h-5 w-5 text-gray-500" />
            <h4 className="font-medium text-lg">Unknown Publication</h4>
            {getPublicationBadge(publication)}
          </div>
          {publication?.doi && (
            <p className="text-sm">
              <span className="font-medium">DOI:</span>{" "}
              <a
                href={`https://doi.org/${publication.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                {publication.doi}
                <ExternalLinkIcon className="h-3 w-3" />
              </a>
            </p>
          )}
          <p className="text-sm text-muted-foreground italic">Full details will be available on the comparison page</p>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {getPublicationIcon(publication.type)}
          <FormattedTitle title={publication.title} className="font-medium text-lg" />
          {getPublicationBadge(publication)}
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">Authors:</span>{" "}
          {publication.authors && publication.authors.length > 0 ? publication.authors.join(", ") : "Unknown Authors"}
        </p>
        {publication.doi && (
          <p className="text-sm">
            <span className="font-medium">DOI:</span>{" "}
            <a
              href={`https://doi.org/${publication.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
            >
              {publication.doi}
              <ExternalLinkIcon className="h-3 w-3" />
            </a>
          </p>
        )}
        {publication.publicationDate && (
          <p className="text-sm">
            <span className="font-medium">Publication Date:</span> {publication.publicationDate}
          </p>
        )}
        {publication.publisher && (
          <p className="text-sm flex items-center gap-1">
            <BookIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">Publisher:</span> {publication.publisher}
          </p>
        )}
        {publication.type === "preprint" && publication.institution && (
          <p className="text-sm flex items-center gap-1">
            <BuildingIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">Preprint Server:</span> {publication.institution}
          </p>
        )}
        {publication.type === "article" && publication.containerTitle && (
          <p className="text-sm flex items-center gap-1">
            <BookIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">Journal:</span> {publication.containerTitle}
          </p>
        )}
      </div>
    )
  }

  // Check if all results have low confidence (indicating no LLM processing)
  const allLowConfidence = results.every((match) => match.confidenceLevel === "Low")

  // Handle empty results
  if (!results || results.length === 0) {
    return (
      <div className="mt-6 p-8 text-center text-muted-foreground">No results found. Try a different search term.</div>
    )
  }

  return (
    <div className="mt-6 space-y-4">
      <h3 className="text-lg font-medium">Search Results</h3>

      {allLowConfidence && (
        <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-md mb-4 text-sm">
          Note: Advanced LLM-based matching is unavailable. Results shown are basic matches from CrossRef.
        </div>
      )}

      <div className="space-y-6">
        {results.map((match, index) => {
          // Determine if this match is high confidence and has both source and match
          const isHighConfidence = match.confidenceLevel === "High" || match.confidenceLevel === "Very High"
          const hasMatch = !!match.match
          const showConfirmButton = isHighConfidence && hasMatch

          // Create URL parameters for the comparison page
          const sourceDoi = match.source.doi
          const matchDoi = match.match?.doi
          const comparisonUrl =
            sourceDoi && matchDoi
              ? `/compare?source=${encodeURIComponent(sourceDoi)}&match=${encodeURIComponent(matchDoi)}&confidence=${encodeURIComponent(match.confidenceLevel)}`
              : null

          // In the component, update the Research Network button URLs to disable enhanced matching when we have Very High confidence:
          const disableEnhanced = shouldDisableEnhancedMatching(results)

          return (
            <Card key={index} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start gap-4 mb-2">
                  <h3 className="text-lg font-semibold">Match #{index + 1}</h3>
                  <div>{getConfidenceBadge(match.confidenceLevel)}</div>
                </div>

                <PublicationDetails publication={match.source} />

                {/* Add Research Network button for source publication */}
                {match.source.doi && (
                  <div className="mt-2 flex justify-end">
                    <a
                      href={`/research-network?anchor=${encodeURIComponent(match.source.doi)}&useMatching=${!disableEnhanced}`}
                      className="inline-block"
                    >
                      <Button
                        variant="outline"
                        className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200 border-indigo-200"
                      >
                        <NetworkIcon className="mr-2 h-4 w-4" />
                        View Research Network
                      </Button>
                    </a>
                  </div>
                )}

                {match.match && (
                  <>
                    <div className="flex items-center my-4">
                      <Separator className="flex-grow" />
                      <div className="mx-4">
                        <ArrowRightIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <Separator className="flex-grow" />
                    </div>

                    <PublicationDetails publication={match.match} />

                    {/* Add Research Network button for matched publication */}
                    {match.match.doi && (
                      <div className="mt-2 flex justify-end">
                        <a
                          href={`/research-network?anchor=${encodeURIComponent(match.match.doi)}&useMatching=${!disableEnhanced}`}
                          className="inline-block"
                        >
                          <Button
                            variant="outline"
                            className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200 border-indigo-200"
                          >
                            <NetworkIcon className="mr-2 h-4 w-4" />
                            View Research Network
                          </Button>
                        </a>
                      </div>
                    )}
                  </>
                )}

                {showConfirmButton && comparisonUrl && (
                  <div className="mt-4 flex justify-end gap-2">
                    <a href={comparisonUrl} className="inline-block">
                      <Button className="bg-blue-600 hover:bg-blue-700">
                        <ArrowsRightLeftIcon className="mr-2 h-4 w-4" />
                        Compare Match
                      </Button>
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
