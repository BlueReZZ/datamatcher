import { type NextRequest, NextResponse } from "next/server"
import { searchArticles } from "@/lib/search-service"

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })
    }

    const results = await searchArticles(query)

    return NextResponse.json({ results })
  } catch (error) {
    console.error("Search API error:", error)
    return NextResponse.json({ error: "Failed to process search request" }, { status: 500 })
  }
}
