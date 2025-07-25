import { type NextRequest, NextResponse } from "next/server"
import { searchDataDryad, searchFigshare, searchAllRepositories } from "@/lib/repository-search"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q") || "Synthetic eco-evolutionary dynamics in simple molecular environment"
  const source = searchParams.get("source") || "all"

  try {
    console.log(`Testing repository search with query: "${query}" and source: "${source}"`)

    let results: any = null

    if (source === "dryad" || source === "all") {
      const dryadResults = await searchDataDryad(query)
      if (source === "dryad") {
        results = dryadResults
      } else {
        results = { ...results, dryad: dryadResults }
      }
    }

    if (source === "figshare" || source === "all") {
      const figshareResults = await searchFigshare(query)
      if (source === "figshare") {
        results = figshareResults
      } else {
        results = { ...results, figshare: figshareResults }
      }
    }

    if (source === "all") {
      const allResults = await searchAllRepositories(query)
      results = { ...results, combined: { datasets: allResults, source: "All Repositories" } }
    }

    return NextResponse.json({
      query,
      source,
      results,
    })
  } catch (error) {
    console.error("Error in test-repositories API route:", error)
    return NextResponse.json(
      {
        error: "Failed to search repositories",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
