import { type NextRequest, NextResponse } from "next/server"
import type { Publication } from "@/lib/types"

const CROSSREF_API_URL = "https://api.crossref.org/works"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const doi = searchParams.get("doi")
  const matchDoi = searchParams.get("matchDoi")

  if (!doi || !matchDoi) {
    return NextResponse.json({ error: "DOI parameters are required" }, { status: 400 })
  }

  try {
    // Fetch both publications in parallel
    const [sourceResponse, matchResponse] = await Promise.all([
      fetch(`${CROSSREF_API_URL}/${encodeURIComponent(doi)}`),
      fetch(`${CROSSREF_API_URL}/${encodeURIComponent(matchDoi)}`),
    ])

    if (!sourceResponse.ok) {
      throw new Error(`Error fetching source publication: ${sourceResponse.status}`)
    }

    if (!matchResponse.ok) {
      throw new Error(`Error fetching match publication: ${matchResponse.status}`)
    }

    const sourceData = await sourceResponse.json()
    const matchData = await matchResponse.json()

    // Convert to our Publication type
    const source = convertToPub(sourceData.message)
    const match = convertToPub(matchData.message)

    // Ensure we're returning valid data
    return NextResponse.json({
      source: sanitizePublication(source),
      match: sanitizePublication(match),
    })
  } catch (error) {
    console.error("Error fetching publications:", error)
    return NextResponse.json({ error: "Failed to fetch publication details" }, { status: 500 })
  }
}

// Thoroughly sanitize the publication data to prevent rendering issues
function sanitizePublication(pub: Publication): Publication {
  // Helper function to sanitize text
  const sanitizeText = (text: string | undefined): string | undefined => {
    if (typeof text !== "string") return undefined

    // Remove all HTML/XML tags and normalize whitespace
    return text
      .replace(/<\/?[^>]+(>|$)/g, "") // More thorough HTML tag removal
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim()
  }

  return {
    title: pub.title || "Unknown Title",
    authors: Array.isArray(pub.authors) && pub.authors.length > 0 ? pub.authors.filter(Boolean) : ["Unknown Author"],
    doi: pub.doi || undefined,
    publicationDate: pub.publicationDate || undefined,
    type: pub.type || "unknown",
    originalType: pub.originalType || undefined,
    subType: pub.subType || undefined,
    publisher: pub.publisher || undefined,
    institution: pub.institution || undefined,
    containerTitle: pub.containerTitle || undefined,
    typeLabel: pub.typeLabel || undefined,
    // Thoroughly sanitize the abstract
    abstract: sanitizeText(pub.abstract),
  }
}

function convertToPub(work: any): Publication {
  try {
    // Extract institution name for preprints
    let institutionName
    try {
      if (work.institution && Array.isArray(work.institution) && work.institution.length > 0) {
        institutionName = work.institution[0].name
      } else if (typeof work.institution === "string") {
        institutionName = work.institution
      }
    } catch (e) {
      console.warn("Error extracting institution:", e)
      institutionName = undefined
    }

    // Handle potentially missing title array
    let title = "Unknown Title"
    try {
      title = Array.isArray(work.title) && work.title.length > 0 ? work.title[0] : "Unknown Title"
    } catch (e) {
      console.warn("Error extracting title:", e)
    }

    // Handle potentially missing authors
    let authors = ["Unknown Author"]
    try {
      authors =
        Array.isArray(work.author) && work.author.length > 0
          ? work.author.map((a: any) => {
              try {
                return `${a.given || ""} ${a.family || ""}`.trim() || "Unknown Author"
              } catch (e) {
                return "Unknown Author"
              }
            })
          : ["Unknown Author"]
    } catch (e) {
      console.warn("Error extracting authors:", e)
    }

    // Extract publisher
    let publisher
    try {
      publisher = work.publisher
    } catch (e) {
      console.warn("Error extracting publisher:", e)
      publisher = undefined
    }

    // Extract container title (journal name)
    let containerTitle
    try {
      containerTitle =
        Array.isArray(work["container-title"]) && work["container-title"].length > 0
          ? work["container-title"][0]
          : undefined
    } catch (e) {
      console.warn("Error extracting container title:", e)
      containerTitle = undefined
    }

    // Extract abstract - handle both standard and JATS XML abstracts
    let abstract
    try {
      if (work.abstract) {
        abstract = work.abstract
      } else if (work["abstract-xml"]) {
        abstract = work["abstract-xml"]
      } else if (work.jats && work.jats.abstract) {
        abstract = work.jats.abstract
      }
    } catch (e) {
      console.warn("Error extracting abstract:", e)
      abstract = undefined
    }

    // Extract sub-type for posted-content
    let subType
    try {
      if (work.type === "posted-content" && work.subtype) {
        subType = work.subtype
      }
    } catch (e) {
      console.warn("Error extracting sub-type:", e)
      subType = undefined
    }

    // Determine publication type
    let type: "preprint" | "article" | "unknown" = "unknown"
    try {
      if (work.type === "posted-content") {
        type = "preprint"
      } else if (work.type === "journal-article") {
        type = "article"
      }
    } catch (e) {
      console.warn("Error determining publication type:", e)
    }

    return {
      title,
      authors,
      doi: work.DOI,
      publicationDate: formatDate(work.published?.["date-parts"]?.[0]),
      type,
      originalType: work.type,
      subType,
      publisher,
      institution: institutionName,
      containerTitle,
      abstract,
    }
  } catch (error) {
    console.error("Error converting work to publication:", error)
    // Return a minimal valid publication object
    return {
      title: "Error retrieving title",
      authors: ["Unknown Author"],
      type: "unknown",
    }
  }
}

function formatDate(dateParts?: number[]): string | undefined {
  if (!dateParts || dateParts.length < 1) return undefined

  try {
    const year = dateParts[0]
    const month = dateParts.length > 1 ? dateParts[1].toString().padStart(2, "0") : "01"
    const day = dateParts.length > 2 ? dateParts[2].toString().padStart(2, "0") : "01"

    return `${year}-${month}-${day}`
  } catch (e) {
    console.warn("Error formatting date:", e)
    return undefined
  }
}
