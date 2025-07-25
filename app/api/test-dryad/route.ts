import { type NextRequest, NextResponse } from "next/server"
import { searchDataDryad } from "@/lib/repository-search"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q") || "Synthetic eco-evolutionary dynamics in simple molecular environment"

  try {
    console.log(`Testing DataDryad search with query: "${query}"`)

    const results = await searchDataDryad(query)

    // Also test the raw API call to see the structure
    const encodedQuery = encodeURIComponent(query)
    const url = `https://datadryad.org/api/v2/search?q=${encodedQuery}&per_page=5`

    let rawResponse = null
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "PrePrintDOIMatcher/1.0 (Research Network Visualization)",
        },
      })

      if (response.ok) {
        rawResponse = await response.json()
      }
    } catch (error) {
      console.error("Error fetching raw response:", error)
    }

    return NextResponse.json({
      query,
      results,
      debug: {
        datasetCount: results.datasets.length,
        source: results.source,
        rawResponseStructure: rawResponse
          ? {
              hasEmbedded: !!rawResponse._embedded,
              embeddedKeys: rawResponse._embedded ? Object.keys(rawResponse._embedded) : [],
              hasStashDatasets: !!(rawResponse._embedded && rawResponse._embedded["stash:datasets"]),
              stashDatasetsCount: rawResponse._embedded?.["stash:datasets"]?.length || 0,
              total: rawResponse.total,
              firstDataset: rawResponse._embedded?.["stash:datasets"]?.[0]
                ? {
                    id: rawResponse._embedded["stash:datasets"][0].id,
                    title: rawResponse._embedded["stash:datasets"][0].title,
                    hasAuthors: !!rawResponse._embedded["stash:datasets"][0].authors,
                    hasSharingLink: !!rawResponse._embedded["stash:datasets"][0].sharingLink,
                    sharingLink: rawResponse._embedded["stash:datasets"][0].sharingLink,
                  }
                : null,
            }
          : null,
      },
      rawResponse: rawResponse
        ? {
            total: rawResponse.total,
            _embedded: rawResponse._embedded,
          }
        : null,
    })
  } catch (error) {
    console.error("Error in test-dryad API route:", error)
    return NextResponse.json(
      {
        error: "Failed to search DataDryad",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
