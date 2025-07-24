import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ArrowLeftIcon,
  FileTextIcon,
  NewspaperIcon,
  BuildingIcon,
  BookIcon,
  ExternalLinkIcon,
  ArrowRightLeftIcon as ArrowsRightLeftIcon,
  PercentIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getPublicationDetails } from "./actions"
import { formatAbstract } from "@/lib/format-abstract"
import { RawDataViewer } from "./raw-data-viewer"
import { ConfirmMatchForm } from "@/components/confirm-match-form"
import { FormattedTitle } from "@/components/formatted-title"

// This is a Server Component
export default async function ComparePage({
  searchParams,
}: {
  searchParams: { source?: string; match?: string; confidence?: string }
}) {
  const sourceDoi = searchParams.source
  const matchDoi = searchParams.match
  const confidenceLevel = searchParams.confidence || "High"

  if (!sourceDoi || !matchDoi) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <a href="/" className="inline-block mb-4">
            <Button variant="outline">
              <ArrowLeftIcon className="mr-2 h-4 w-4" />
              Back to Search
            </Button>
          </a>
          <Card className="bg-destructive/10 text-destructive">
            <CardContent className="p-6">
              <p>Missing DOI parameters</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Fetch data on the server
  let sourcePublication
  let matchPublication
  let error = null

  try {
    const data = await getPublicationDetails(sourceDoi, matchDoi)
    sourcePublication = data.source
    matchPublication = data.match
  } catch (err) {
    console.error("Error fetching publications:", err)
    error = "Failed to load publication details"
  }

  if (error) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <a href="/" className="inline-block mb-4">
            <Button variant="outline">
              <ArrowLeftIcon className="mr-2 h-4 w-4" />
              Back to Search
            </Button>
          </a>
          <Card className="bg-destructive/10 text-destructive">
            <CardContent className="p-6">
              <p>{error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Format abstracts on the server
  const sourceAbstractHtml = formatAbstract(sourcePublication.abstract)
  const matchAbstractHtml = formatAbstract(matchPublication.abstract)

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <a href="/?preserveResults=true" className="inline-block mb-4">
          <Button variant="outline">
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            Back to Search
          </Button>
        </a>

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
                <div className="flex items-center justify-between">
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
                  {/* Raw Data Viewer */}
                  {sourcePublication.doi && (
                    <RawDataViewer
                      doi={sourcePublication.doi}
                      publicationType={sourcePublication.type === "preprint" ? "Preprint" : "Article"}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormattedTitle title={sourcePublication.title} className="text-xl font-semibold" />

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
                  <div className="text-sm bg-muted/50 p-4 rounded-md prose prose-sm max-w-none dark:prose-invert">
                    <div dangerouslySetInnerHTML={{ __html: sourceAbstractHtml }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Match Publication */}
          {matchPublication && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
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
                  {/* Raw Data Viewer */}
                  {matchPublication.doi && (
                    <RawDataViewer
                      doi={matchPublication.doi}
                      publicationType={matchPublication.type === "preprint" ? "Preprint" : "Article"}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormattedTitle title={matchPublication.title} className="text-xl font-semibold" />

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
                  <div className="text-sm bg-muted/50 p-4 rounded-md prose prose-sm max-w-none dark:prose-invert">
                    <div dangerouslySetInnerHTML={{ __html: matchAbstractHtml }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Confirm Match Button - Using client component */}
        <ConfirmMatchForm sourceDoi={sourceDoi} matchDoi={matchDoi} />
      </div>
    </div>
  )
}
