import type { ReactNode } from "react"
import type { ArticleMatch, Publication } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import {
  ExternalLinkIcon,
  ArrowRightIcon,
  BuildingIcon,
  BookIcon,
  HelpCircleIcon,
  ArrowRightLeftIcon as ArrowsRightLeftIcon,
  NetworkIcon,
  RefreshCwIcon,
  ChevronRightIcon,
} from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { FormattedTitle } from "@/components/formatted-title"
import { PublicationTypeIcon, PublicationTypeBadge } from "@/components/publication-type"
import { getConfidenceStripInfo } from "@/components/confidence-badge"
import Link from "next/link"

interface SearchResultsProps {
  results: ArticleMatch[]
  onForceEnhancedMatching?: () => void
  isLoading?: boolean
}

export function SearchResults({ results, onForceEnhancedMatching, isLoading }: SearchResultsProps) {
  const shouldDisableEnhancedMatching = (results: ArticleMatch[]) => {
    return results.some((match) => match.confidenceLevel === "Very High")
  }

  const PublicationDetails = ({
    publication,
    networkAction,
  }: { publication: Publication; networkAction?: ReactNode }) => {
    if (!publication || !publication.title || publication.title === "Unknown Title") {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <PublicationTypeBadge publication={publication} />
            {networkAction}
          </div>
          <div className="flex items-center gap-2">
            <HelpCircleIcon className="h-5 w-5 text-gray-500" />
            <h4 className="font-medium text-lg">Unknown Publication</h4>
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
        <div className="flex items-center justify-between gap-2">
          <PublicationTypeBadge publication={publication} />
          {networkAction}
        </div>
        <div className="flex items-center gap-2">
          <PublicationTypeIcon type={publication.type} />
          <FormattedTitle title={publication.title} className="font-medium text-lg" />
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

  const allLowConfidence = results.every((match) => match.confidenceLevel === "Low")
  const hasDirectMatch = results.some((match) => match.confidenceLevel === "Very High")

  if (!results || results.length === 0) {
    return (
      <div className="mt-6 p-8 text-center text-muted-foreground">No results found. Try a different search term.</div>
    )
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-medium">Search Results</h3>

        {hasDirectMatch && onForceEnhancedMatching && (
          <Button variant="outline" size="sm" onClick={onForceEnhancedMatching} disabled={isLoading}>
            <RefreshCwIcon className="mr-2 h-3.5 w-3.5" />
            Not sure this is right? Force full matching
          </Button>
        )}
      </div>

      {allLowConfidence && (
        <div className="p-3 bg-warning/10 text-warning rounded-md mb-4 text-sm">
          Note: Advanced LLM-based matching is unavailable. Results shown are basic matches from CrossRef.
        </div>
      )}

      <div className="space-y-6">
        {results.map((match, index) => {
          const isConfidentEnoughToCompare =
            match.confidenceLevel === "High" ||
            match.confidenceLevel === "Very High" ||
            match.confidenceLevel === "Medium"
          const hasMatch = !!match.match
          const showConfirmButton = isConfidentEnoughToCompare && hasMatch

          const sourceDoi = match.source.doi
          const matchDoi = match.match?.doi
          const comparisonUrl =
            sourceDoi && matchDoi
              ? `/compare?source=${encodeURIComponent(sourceDoi)}&match=${encodeURIComponent(matchDoi)}&confidence=${encodeURIComponent(match.confidenceLevel)}`
              : null

          const disableEnhanced = shouldDisableEnhancedMatching(results)

          const strip = getConfidenceStripInfo(match.confidenceLevel)
          const StripIcon = strip.icon

          const renderNetworkAction = (doi?: string) => {
            if (!doi) return null
            return (
              <Link href={`/research-network?anchor=${encodeURIComponent(doi)}&useMatching=${!disableEnhanced}`}>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-auto py-1 px-2.5 gap-1 text-xs font-bold uppercase tracking-wide bg-info/10 text-info hover:bg-info/20 border-info/30"
                >
                  <NetworkIcon className="h-3 w-3" />
                  View Research Network
                </Button>
              </Link>
            )
          }

          return (
            <Card
              key={index}
              className="overflow-hidden bg-white text-foreground hover:shadow-md transition-shadow py-0 gap-0"
            >
              {showConfirmButton && comparisonUrl ? (
                <Link
                  href={comparisonUrl}
                  className={`flex items-center justify-between gap-4 px-6 py-3 hover:brightness-95 transition-[filter] ${strip.classes}`}
                >
                  <span className="font-semibold">Match #{index + 1}</span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <StripIcon className="h-4 w-4" />
                    {strip.label}
                    <ChevronRightIcon className="h-4 w-4" />
                  </span>
                </Link>
              ) : (
                <div className={`flex items-center justify-between gap-4 px-6 py-3 ${strip.classes}`}>
                  <span className="font-semibold">Match #{index + 1}</span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <StripIcon className="h-4 w-4" />
                    {strip.label}
                  </span>
                </div>
              )}

              <CardContent className="p-6">
                <PublicationDetails publication={match.source} networkAction={renderNetworkAction(match.source.doi)} />

                {match.match && (
                  <>
                    <div className="flex items-center my-4">
                      <Separator className="flex-grow" />
                      <div className="mx-4">
                        <ArrowRightIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <Separator className="flex-grow" />
                    </div>

                    <PublicationDetails publication={match.match} networkAction={renderNetworkAction(match.match.doi)} />
                  </>
                )}

                {showConfirmButton && comparisonUrl && (
                  <>
                    <Separator className="my-6" />
                    <div className="flex justify-center">
                      <Link href={comparisonUrl}>
                        <Button size="lg">
                          <ArrowsRightLeftIcon className="mr-2 h-4 w-4" />
                          Compare Match
                        </Button>
                      </Link>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
