import { type NextRequest, NextResponse } from "next/server"

const CROSSREF_API_URL = "https://api.crossref.org/works"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const doi = searchParams.get("doi")

  if (!doi) {
    return NextResponse.json({ error: "DOI parameter is required" }, { status: 400 })
  }

  try {
    console.log(`Fetching raw CrossRef data for DOI: ${doi}`)

    // Fetch the raw publication data
    const response = await fetch(`${CROSSREF_API_URL}/${encodeURIComponent(doi)}`, {
      headers: {
        "User-Agent": "PrePrintDOIMatcher/1.0 (mailto:support@example.com)",
      },
    })

    if (!response.ok) {
      console.error(`Error fetching publication: ${response.status}`)
      throw new Error(`Error fetching publication: ${response.status}`)
    }

    const data = await response.json()
    console.log(`Successfully fetched raw data for DOI: ${doi}`)

    // Return the raw CrossRef data
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching raw publication data:", error)
    return NextResponse.json({ error: "Failed to fetch publication details" }, { status: 500 })
  }
}
