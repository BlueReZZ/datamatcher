"use server"

import type { ArticleMatch, CrossRefResponse, CrossRefWork, Publication, PublicationType } from "./types"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { getTypeLabel } from "./crossref-types"

type ConfidenceLevel = "High" | "Medium" | "Low"

const CROSSREF_API_URL = "https://api.crossref.org/works"
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const CROSSREF_PLUS_TOKEN = process.env.CROSSREF_PLUS_TOKEN

// Timeout constants for Vercel deployment
const LLM_TIMEOUT_MS = 15000 // 15 seconds for LLM calls
const TOTAL_FUNCTION_TIMEOUT_MS = 45000 // 45 seconds total (well under Vercel's 60s limit)

// Interface for advanced search parameters
export interface AdvancedSearchParams {
  title?: string
  author?: string
  containerTitle?: string // Keeping this for backward compatibility
  funderName?: string
}

// New function to search by ORCID
export async function searchByOrcid(orcid: string): Promise<ArticleMatch[]> {
  try {
    // Step 1: Search CrossRef API with ORCID filter
    const works = await searchCrossRefByOrcid(orcid)

    // If no results from CrossRef, return empty array
    if (!works || works.length === 0) {
      console.log("No results found from CrossRef API for ORCID:", orcid)
      return []
    }

    // Step 2: Process the works to find potential matches and categorize by type
    const results = await processOrcidWorks(works)

    return results
  } catch (error) {
    console.error("Error in searchByOrcid:", error)

    // Provide more specific error message
    if (error instanceof Error) {
      throw new Error(`Failed to search for publications by ORCID: ${error.message}`)
    } else {
      throw new Error("Failed to search for publications by ORCID")
    }
  }
}

// Function to search CrossRef by ORCID
async function searchCrossRefByOrcid(orcid: string): Promise<CrossRefWork[]> {
  try {
    // Use the filter parameter to search by ORCID
    const params = new URLSearchParams({
      filter: `orcid:${orcid}`,
      rows: "100", // Get more results for a comprehensive view
    })

    console.log(`Searching CrossRef API with ORCID: ${orcid}`)
    const headers = getCrossRefHeaders()
    logRequestHeaders(headers, "searchCrossRefByOrcid")

    const response = await fetch(`${CROSSREF_API_URL}?${params.toString()}`, {
      headers,
    })

    await logResponseDetails(response, "searchCrossRefByOrcid")

    if (!response.ok) {
      throw new Error(`CrossRef API error: ${response.status}`)
    }

    const data: CrossRefResponse = await response.json()

    if (!data.message || !Array.isArray(data.message.items)) {
      console.error("Unexpected CrossRef API response format:", data)
      throw new Error("Invalid response format from CrossRef API")
    }

    console.log(`Found ${data.message.items.length} results from CrossRef API for ORCID: ${orcid}`)

    return data.message.items
  } catch (error) {
    console.error("Error searching CrossRef by ORCID:", error)
    throw error
  }
}

// Helper function to get CrossRef API headers with Plus token if available
function getCrossRefHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "User-Agent": "OpenScienceDataMatcher/1.0 (paul@elifetechnology.org)",
  }

  if (CROSSREF_PLUS_TOKEN) {
    headers["Crossref-Plus-API-Token"] = `Bearer ${CROSSREF_PLUS_TOKEN}`
    console.log("CrossRef Plus token detected and will be included in headers")
  } else {
    console.log("No CrossRef Plus API token found, using standard API")
  }

  return headers
}

// Helper function to log request headers for debugging
function logRequestHeaders(headers: HeadersInit, functionName: string) {
  console.log(`=== ${functionName} Request Headers ===`)

  if (headers && typeof headers === "object") {
    Object.entries(headers).forEach(([key, value]) => {
      if (key === "Crossref-Plus-API-Token") {
        // Log the token but mask most of it for security
        const tokenValue = String(value)
        if (tokenValue.startsWith("Bearer ")) {
          const token = tokenValue.substring(7) // Remove "Bearer " prefix
          const maskedToken =
            token.length > 8 ? `${token.substring(0, 4)}...${token.substring(token.length - 4)}` : "***masked***"
          console.log(`  ${key}: Bearer ${maskedToken}`)
        } else {
          console.log(`  ${key}: ${tokenValue.substring(0, 10)}...`)
        }
      } else {
        console.log(`  ${key}: ${value}`)
      }
    })
  }

  console.log(`=== End ${functionName} Request Headers ===`)
}

// Helper function to log detailed response information for debugging
async function logResponseDetails(response: Response, functionName: string) {
  console.log(`=== ${functionName} Response Details ===`)
  console.log(`Status: ${response.status} ${response.statusText}`)
  console.log(`URL: ${response.url}`)
  console.log(`Headers:`)

  // Log response headers
  response.headers.forEach((value, key) => {
    console.log(`  ${key}: ${value}`)
  })

  // If it's an error response, try to get the response body
  if (!response.ok) {
    try {
      const responseText = await response.clone().text()
      console.log(`Response Body:`, responseText)

      // Try to parse as JSON if possible
      try {
        const responseJson = JSON.parse(responseText)
        console.log(`Response JSON:`, JSON.stringify(responseJson, null, 2))
      } catch (jsonError) {
        console.log(`Response is not valid JSON`)
      }
    } catch (bodyError) {
      console.log(`Could not read response body:`, bodyError)
    }
  }

  console.log(`=== End ${functionName} Response Details ===`)
}

// Process works from ORCID search to find matches and categorize by type
async function processOrcidWorks(works: CrossRefWork[]): Promise<ArticleMatch[]> {
  try {
    const results: ArticleMatch[] = []

    // Step 1: Extract direct matches from CrossRef metadata
    try {
      const directMatches = await extractDirectMatches(works)

      // Add direct matches to results
      results.push(...directMatches)

      // Create a set of DOIs that are already in matches
      const matchedDOIs = new Set<string>()
      directMatches.forEach((match) => {
        if (match.source.doi) matchedDOIs.add(match.source.doi)
        if (match.match?.doi) matchedDOIs.add(match.match.doi)
      })

      // Step 2: Try to find additional matches among the remaining works
      const unmatchedWorks = works.filter((work) => !matchedDOIs.has(work.DOI))

      if (unmatchedWorks.length > 0) {
        // Try basic matching for unmatched works
        const basicMatches = performBasicMatching(unmatchedWorks)

        // Add basic matches to results
        for (const match of basicMatches) {
          if (match.confidenceLevel !== "Low" || !match.match) {
            results.push(match)

            // Add these DOIs to the matched set
            if (match.source.doi) matchedDOIs.add(match.source.doi)
            if (match.match?.doi) matchedDOIs.add(match.match.doi)
          }
        }

        // Step 3: For remaining unmatched works, add them as individual results
        const remainingWorks = unmatchedWorks.filter((work) => !matchedDOIs.has(work.DOI))

        for (const work of remainingWorks) {
          const publication = await enhancePublication(convertToPub(work))
          results.push({
            source: publication,
            confidenceLevel: "Low",
          })
        }
      }
    } catch (error) {
      console.error("Error processing ORCID works:", error)

      // If there's an error in the matching process, just convert all works to publications
      return works.map((work) => ({
        source: convertToPub(work),
        confidenceLevel: "Low",
      }))
    }

    return results
  } catch (error) {
    console.error("Error in processOrcidWorks:", error)
    throw error
  }
}

// Enhance a publication with a human-readable type label
async function enhancePublication(publication: Publication): Promise<Publication> {
  try {
    if (publication.originalType) {
      const typeLabel = await getTypeLabel(publication.originalType, publication.subType)
      return {
        ...publication,
        typeLabel: typeLabel,
      }
    }
    return publication
  } catch (error) {
    console.error("Error enhancing publication:", error)
    return publication
  }
}

export async function searchArticles(query: string): Promise<ArticleMatch[]> {
  const startTime = Date.now()

  try {
    console.log(`=== Starting searchArticles with query: "${query}" ===`)

    // Step 1: Search CrossRef API
    const crossRefResults = await searchCrossRef(query)

    // If no results from CrossRef, return empty array
    if (!crossRefResults || crossRefResults.length === 0) {
      console.log("No results found from CrossRef API")
      return []
    }

    console.log(`Found ${crossRefResults.length} results from CrossRef API`)

    // Step 1.5: If we only have one result, try a broader search to find more potential matches
    let finalResults = crossRefResults
    if (crossRefResults.length === 1) {
      console.log("Only one result found. Attempting broader search to find more potential matches...")
      try {
        const broaderResults = await searchCrossRefBroader(query)
        if (broaderResults && broaderResults.length > 1) {
          console.log(`Broader search found ${broaderResults.length} results, using those instead`)
          finalResults = broaderResults
        }
      } catch (error) {
        console.error("Error in broader search, continuing with original results:", error)
      }
    }

    console.log("Publication types in results:", finalResults.map((w) => w.type).join(", "))

    // Step 2: Extract direct matches from CrossRef metadata
    try {
      const directMatches = await extractDirectMatches(finalResults)

      // If we have direct matches, return them immediately
      if (directMatches.length > 0) {
        console.log(`Found ${directMatches.length} direct matches, returning them`)

        // Check if we have Very High confidence matches - if so, we don't need enhanced matching
        const hasVeryHighConfidence = directMatches.some((match) => match.confidenceLevel === "Very High")
        if (hasVeryHighConfidence) {
          console.log("Very High confidence matches found - enhanced matching not needed")
        }

        return directMatches
      }
    } catch (error) {
      console.error("Error extracting direct matches:", error)
      // Continue to basic matching if direct matching fails
    }

    // Step 3: Try basic title and author matching
    try {
      const basicMatches = performBasicMatching(finalResults)

      // Check if we have good quality basic matches
      const highQualityMatches = basicMatches.filter(
        (match) => match.confidenceLevel === "High" || match.confidenceLevel === "Medium",
      )

      const matchesWithPairs = basicMatches.filter((match) => match.match !== undefined)

      // Return basic matches if we have either:
      // 1. High/Medium confidence matches, OR
      // 2. Multiple matched pairs with at least some medium/high confidence
      if (highQualityMatches.length > 0 || (matchesWithPairs.length >= 2 && highQualityMatches.length > 0)) {
        console.log(
          `Found good basic matches: ${highQualityMatches.length} high-quality, ${matchesWithPairs.length} with pairs. Returning without LLM.`,
        )
        return basicMatches
      }

      console.log(
        `Basic matching found ${basicMatches.length} matches but quality is insufficient for skipping LLM: ${highQualityMatches.length} high-quality, ${matchesWithPairs.length} with pairs. Will attempt LLM.`,
      )
    } catch (error) {
      console.error("Error in basic matching:", error)
      // Continue to LLM matching if basic matching fails
    }

    // Step 4: Only attempt LLM matching if basic matching didn't find good results
    // Also check if we have enough time left for LLM matching
    const elapsedTime = Date.now() - startTime
    const timeRemaining = TOTAL_FUNCTION_TIMEOUT_MS - elapsedTime

    if (timeRemaining < LLM_TIMEOUT_MS + 5000) {
      console.log(`Not enough time remaining (${timeRemaining}ms) for LLM matching, falling back to basic results`)
      // Return the basic matches we found, even if they're low quality
      try {
        return performBasicMatching(finalResults)
      } catch (error) {
        console.error("Error in fallback basic matching:", error)
        return finalResults.slice(0, 5).map((work) => ({
          source: safeConvertToPub(work),
          confidenceLevel: "Low",
        }))
      }
    }

    // Check if we have the right conditions for LLM matching
    const preprints = finalResults.filter((w) => w.type === "posted-content")
    const articles = finalResults.filter((w) => w.type === "journal-article")

    if (preprints.length === 0 || articles.length === 0) {
      console.log("No preprints or articles for LLM matching, returning basic results")
      return finalResults.slice(0, 5).map((work) => ({
        source: safeConvertToPub(work),
        confidenceLevel: "Low",
      }))
    }

    // Step 5: Attempt LLM matching as last resort
    try {
      console.log("Basic matching didn't find good results. Attempting LLM fuzzy matching...")
      const fuzzyMatches = await performFuzzyMatchingWithTimeout(query, finalResults, timeRemaining - 5000)
      console.log(`LLM fuzzy matching returned ${fuzzyMatches.length} matches`)
      return fuzzyMatches
    } catch (error) {
      console.error("Error in fuzzy matching:", error)

      // Fallback to basic results if fuzzy matching fails
      console.log("LLM matching failed, falling back to basic results")
      try {
        return performBasicMatching(finalResults)
      } catch (basicError) {
        console.error("Error in fallback basic matching:", basicError)
        return finalResults.slice(0, 5).map((work) => ({
          source: safeConvertToPub(work),
          confidenceLevel: "Low",
        }))
      }
    }
  } catch (error) {
    console.error("Error in searchArticles:", error)

    // Provide more specific error message
    if (error instanceof Error) {
      throw new Error(`Failed to search for articles: ${error.message}`)
    } else {
      throw new Error("Failed to search for articles")
    }
  }
}

// New function for advanced search
export async function searchArticlesAdvanced(params: AdvancedSearchParams): Promise<ArticleMatch[]> {
  try {
    // Step 1: Search CrossRef API with advanced parameters
    const crossRefResults = await searchCrossRefAdvanced(params)

    // If no results from CrossRef, return empty array
    if (!crossRefResults || crossRefResults.length === 0) {
      console.log("No results found from CrossRef API")
      return []
    }

    // Step 2: Extract direct matches from CrossRef metadata
    try {
      const directMatches = await extractDirectMatches(crossRefResults)

      // If we have direct matches, return them immediately
      if (directMatches.length > 0) {
        console.log(`Found ${directMatches.length} direct matches from advanced search, returning them`)
        return directMatches
      }
    } catch (error) {
      console.error("Error extracting direct matches:", error)
      // Continue to basic matching if direct matching fails
    }

    // Step 3: Try basic title and author matching
    try {
      const basicMatches = performBasicMatching(crossRefResults)

      // Check if we have good quality basic matches
      const highQualityMatches = basicMatches.filter(
        (match) => match.confidenceLevel === "High" || match.confidenceLevel === "Medium",
      )

      const matchesWithPairs = basicMatches.filter((match) => match.match !== undefined)

      // Return basic matches if we have good results
      if (highQualityMatches.length > 0 || (matchesWithPairs.length >= 2 && highQualityMatches.length > 0)) {
        console.log(
          `Advanced search found good basic matches: ${highQualityMatches.length} high-quality, ${matchesWithPairs.length} with pairs. Returning without LLM.`,
        )
        return basicMatches
      }

      console.log(
        `Advanced search basic matching found ${basicMatches.length} matches but quality is insufficient for skipping LLM. Will attempt LLM.`,
      )
    } catch (error) {
      console.error("Error in basic matching:", error)
      // Continue to LLM matching if basic matching fails
    }

    // Step 4: Only attempt LLM matching if basic matching didn't find good results
    try {
      // Create a query string from the advanced parameters for the LLM
      const queryString = Object.entries(params)
        .filter(([_, value]) => value)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ")

      console.log("Advanced search: Basic matching didn't find good results. Attempting LLM fuzzy matching...")
      const fuzzyMatches = await performFuzzyMatchingWithTimeout(queryString, crossRefResults, LLM_TIMEOUT_MS)
      return fuzzyMatches
    } catch (error) {
      console.error("Error in fuzzy matching:", error)

      // Fallback to basic results if fuzzy matching fails
      console.log("Advanced search: LLM matching failed, falling back to basic results")
      try {
        return performBasicMatching(crossRefResults)
      } catch (basicError) {
        console.error("Error in fallback basic matching:", basicError)
        return crossRefResults.slice(0, 5).map((work) => ({
          source: safeConvertToPub(work),
          confidenceLevel: "Low",
        }))
      }
    }
  } catch (error) {
    console.error("Error in searchArticlesAdvanced:", error)

    // Provide more specific error message
    if (error instanceof Error) {
      throw new Error(`Failed to search for articles: ${error.message}`)
    } else {
      throw new Error("Failed to search for articles")
    }
  }
}

async function searchCrossRef(query: string): Promise<CrossRefWork[]> {
  try {
    // Use a different approach: don't limit fields with select parameter
    const params = new URLSearchParams({
      query: query,
      rows: "20", // Increased to get more potential matches
    })

    console.log(`Searching CrossRef API with query: ${query}`)
    const headers = getCrossRefHeaders()
    logRequestHeaders(headers, "searchCrossRef")

    const response = await fetch(`${CROSSREF_API_URL}?${params.toString()}`, {
      headers,
    })

    await logResponseDetails(response, "searchCrossRef")

    if (!response.ok) {
      throw new Error(`CrossRef API error: ${response.status}`)
    }

    const data: CrossRefResponse = await response.json()

    if (!data.message || !Array.isArray(data.message.items)) {
      console.error("Unexpected CrossRef API response format:", data)
      throw new Error("Invalid response format from CrossRef API")
    }

    console.log(`Found ${data.message.items.length} results from CrossRef API`)

    return data.message.items
  } catch (error) {
    console.error("Error searching CrossRef:", error)
    throw error
  }
}

// New function for broader search when initial search yields limited results
async function searchCrossRefBroader(originalQuery: string): Promise<CrossRefWork[]> {
  try {
    // Clean and normalize the query
    const cleanQuery = originalQuery.replace(/\s+/g, " ").trim()

    const words = cleanQuery.split(" ").filter((word) => word.length > 2) // Filter out very short words

    // Take first two meaningful words
    const titleWords = words.slice(0, 2).join(" ")

    // Try to extract what might be an author name (look for capitalized words)
    const capitalizedWords = words.filter((word) => /^[A-Z][a-z]+$/.test(word))
    const possibleAuthor = capitalizedWords.length > 0 ? capitalizedWords[0] : ""

    // Create broader search query
    let broaderQuery = titleWords
    if (possibleAuthor && !titleWords.includes(possibleAuthor)) {
      broaderQuery += ` ${possibleAuthor}`
    }

    console.log(`Broader search query: "${broaderQuery}" (from original: "${originalQuery}")`)

    const params = new URLSearchParams({
      query: broaderQuery,
      rows: "50", // Increased results for broader search
    })

    const headers = getCrossRefHeaders()
    logRequestHeaders(headers, "searchCrossRefBroader")

    const response = await fetch(`${CROSSREF_API_URL}?${params.toString()}`, {
      headers,
    })

    await logResponseDetails(response, "searchCrossRefBroader")

    if (!response.ok) {
      throw new Error(`CrossRef API error: ${response.status}`)
    }

    const data: CrossRefResponse = await response.json()

    if (!data.message || !Array.isArray(data.message.items)) {
      console.error("Unexpected CrossRef API response format:", data)
      throw new Error("Invalid response format from CrossRef API")
    }

    console.log(`Broader search found ${data.message.items.length} results`)
    return data.message.items
  } catch (error) {
    console.error("Error in broader CrossRef search:", error)
    throw error
  }
}

// New function for advanced CrossRef search
async function searchCrossRefAdvanced(params: AdvancedSearchParams): Promise<CrossRefWork[]> {
  try {
    const searchParams = new URLSearchParams()

    // Add each parameter if it exists
    if (params.title) {
      searchParams.append("query.title", params.title)
    }

    if (params.author) {
      searchParams.append("query.author", params.author)
    }

    // Only add container-title if it exists (for backward compatibility)
    if (params.containerTitle) {
      searchParams.append("query.container-title", params.containerTitle)
    }

    if (params.funderName) {
      searchParams.append("query.funder-name", params.funderName)
    }

    // Set number of results
    searchParams.append("rows", "20")

    console.log(`Searching CrossRef API with advanced parameters: ${searchParams.toString()}`)
    const headers = getCrossRefHeaders()
    logRequestHeaders(headers, "searchCrossRefAdvanced")

    const response = await fetch(`${CROSSREF_API_URL}?${searchParams.toString()}`, {
      headers,
    })

    await logResponseDetails(response, "searchCrossRefAdvanced")

    if (!response.ok) {
      throw new Error(`CrossRef API error: ${response.status}`)
    }

    const data: CrossRefResponse = await response.json()

    if (!data.message || !Array.isArray(data.message.items)) {
      console.error("Unexpected CrossRef API response format:", data)
      throw new Error("Invalid response format from CrossRef API")
    }

    console.log(`Found ${data.message.items.length} results from CrossRef API`)

    return data.message.items
  } catch (error) {
    console.error("Error searching CrossRef with advanced parameters:", error)
    throw error
  }
}

function determinePublicationType(workType: string): PublicationType {
  if (!workType) return "unknown"

  if (workType === "posted-content") {
    return "preprint"
  } else if (workType === "journal-article") {
    return "article"
  } else {
    return "unknown"
  }
}

// Safe version of convertToPub that handles potential missing fields
function safeConvertToPub(work: CrossRefWork): Publication {
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
          ? work.author.map((a) => {
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

    // Extract abstract
    let abstract
    try {
      abstract = work.abstract
    } catch (e) {
      console.warn("Error extracting abstract:", e)
      abstract = undefined
    }

    return {
      title,
      authors,
      doi: work.DOI,
      publicationDate: formatDate(work.published?.["date-parts"]?.[0]),
      type: determinePublicationType(work.type),
      originalType: work.type,
      publisher: publisher,
      institution: institutionName,
      containerTitle: containerTitle,
      abstract: abstract,
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

// Original convertToPub function
function convertToPub(work: CrossRefWork): Publication {
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
          ? work.author.map((a) => {
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

    // Extract abstract
    let abstract
    try {
      abstract = work.abstract
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
    let type: PublicationType = "unknown"
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

// Helper function to fetch publication details by DOI
async function fetchPublicationByDOI(doi: string): Promise<Publication | null> {
  try {
    console.log(`Fetching publication details for DOI: ${doi}`)
    const headers = getCrossRefHeaders()
    logRequestHeaders(headers, "fetchPublicationByDOI")

    const response = await fetch(`${CROSSREF_API_URL}/${encodeURIComponent(doi)}`, {
      headers,
    })

    await logResponseDetails(response, "fetchPublicationByDOI")

    if (!response.ok) {
      console.warn(`Failed to fetch publication details for DOI ${doi}: ${response.status}`)
      return null
    }

    const data = await response.json()

    if (!data.message) {
      console.warn(`Invalid response format for DOI ${doi}`)
      return null
    }

    const publication = convertToPub(data.message)
    console.log(`Successfully fetched publication details for DOI ${doi}:`, {
      title: publication.title,
      authors: publication.authors,
      type: publication.type,
    })

    return publication
  } catch (error) {
    console.error(`Error fetching publication details for DOI ${doi}:`, error)
    return null
  }
}

// Updated to be async to fetch missing publication details
async function extractDirectMatches(works: CrossRefWork[]): Promise<ArticleMatch[]> {
  try {
    const matches: ArticleMatch[] = []
    const doiMap = new Map<string, CrossRefWork>()

    // Create a map of DOIs to works for easy lookup
    works.forEach((work) => {
      if (work.DOI) {
        doiMap.set(work.DOI, work)
      }
    })

    for (const work of works) {
      // Skip works without DOI
      if (!work.DOI) continue

      // Check if this work has explicit preprint relations
      if (work.relation?.["has-preprint"]?.length) {
        const preprintDOIs = work.relation["has-preprint"]
          .filter((rel) => rel["id-type"] === "doi")
          .map((rel) => rel.id)

        // For each related preprint DOI, check if we have it in our results
        for (const preprintDOI of preprintDOIs) {
          const preprint = doiMap.get(preprintDOI)

          if (preprint) {
            const sourcePub = await enhancePublication(convertToPub(work))
            const matchPub = await enhancePublication(convertToPub(preprint))

            matches.push({
              source: sourcePub,
              match: matchPub,
              confidenceLevel: "Very High",
            })
          } else {
            // We don't have the preprint in our results, but we know its DOI
            // Let's try to fetch it directly
            const preprintDetails = await fetchPublicationByDOI(preprintDOI)

            if (preprintDetails) {
              // We successfully fetched the preprint details
              const sourcePub = await enhancePublication(convertToPub(work))
              const matchPub = await enhancePublication(preprintDetails)

              matches.push({
                source: sourcePub,
                match: matchPub,
                confidenceLevel: "Very High",
              })
            } else {
              // We couldn't fetch the preprint details, use minimal info
              const sourcePub = await enhancePublication(convertToPub(work))

              matches.push({
                source: sourcePub,
                match: {
                  title: "Unknown Title",
                  authors: [],
                  doi: preprintDOI,
                  type: "preprint",
                  originalType: "posted-content",
                },
                confidenceLevel: "Very High",
              })
            }
          }
        }
      } else if (work.relation?.["is-preprint-of"]?.length) {
        const articleDOIs = work.relation["is-preprint-of"]
          .filter((rel) => rel["id-type"] === "doi")
          .map((rel) => rel.id)

        // For each related article DOI, check if we have it in our results
        for (const articleDOI of articleDOIs) {
          const article = doiMap.get(articleDOI)

          if (article) {
            const sourcePub = await enhancePublication(convertToPub(work))
            const matchPub = await enhancePublication(convertToPub(article))

            matches.push({
              source: sourcePub,
              match: matchPub,
              confidenceLevel: "Very High",
            })
          } else {
            // We don't have the article in our results, but we know its DOI
            // Let's try to fetch it directly
            const articleDetails = await fetchPublicationByDOI(articleDOI)

            if (articleDetails) {
              // We successfully fetched the article details
              const sourcePub = await enhancePublication(convertToPub(work))
              const matchPub = await enhancePublication(articleDetails)

              matches.push({
                source: sourcePub,
                match: matchPub,
                confidenceLevel: "Very High",
              })
            } else {
              // We couldn't fetch the article details, use minimal info
              const sourcePub = await enhancePublication(convertToPub(work))

              matches.push({
                source: sourcePub,
                match: {
                  title: "Unknown Title",
                  authors: [],
                  doi: articleDOI,
                  type: "article",
                  originalType: "journal-article",
                },
                confidenceLevel: "Very High",
              })
            }
          }
        }
      }
    }

    // If no explicit relations were found, return empty array to continue to next matching method
    return matches
  } catch (error) {
    console.error("Error in extractDirectMatches:", error)
    throw error
  }
}

// Enhanced function for basic title and author matching that works bidirectionally
function performBasicMatching(works: CrossRefWork[]): ArticleMatch[] {
  try {
    console.log("=== Starting performBasicMatching ===")

    // Separate preprints and articles
    const preprints = works.filter((w) => w.type === "posted-content")
    const articles = works.filter((w) => w.type === "journal-article")

    console.log(`Basic matching: Found ${preprints.length} preprints and ${articles.length} articles`)

    const matches: ArticleMatch[] = []

    // Function to find matches between two sets of works
    const findMatches = (
      sourceWorks: CrossRefWork[],
      targetWorks: CrossRefWork[],
      sourceType: string,
      targetType: string,
    ) => {
      console.log(`Looking for matches from ${sourceType} to ${targetType}`)

      for (const source of sourceWorks) {
        const sourceTitle = source.title?.[0]?.toLowerCase() || ""
        if (!sourceTitle) continue

        // Get source authors
        const sourceAuthors = source.author?.map((a) => `${a.family || ""}`.toLowerCase().trim()).filter(Boolean) || []

        let bestMatch: CrossRefWork | null = null
        let bestTitleScore = 0
        let bestAuthorScore = 0

        for (const target of targetWorks) {
          const targetTitle = target.title?.[0]?.toLowerCase() || ""
          if (!targetTitle) continue

          // Calculate title similarity
          let titleScore = 0

          // Exact title match
          if (sourceTitle === targetTitle) {
            titleScore = 1.0
          } else {
            // Calculate similarity based on common words
            const sourceWords = sourceTitle.split(/\s+/).filter((w) => w.length > 3)
            const targetWords = targetTitle.split(/\s+/).filter((w) => w.length > 3)

            // Count common words
            const sourceWordSet = new Set(sourceWords)
            let commonWords = 0

            for (const word of targetWords) {
              if (sourceWordSet.has(word)) {
                commonWords++
              }
            }

            titleScore = commonWords / Math.max(sourceWords.length, targetWords.length)
          }

          // Only consider matches with reasonable title similarity
          if (titleScore < 0.5) continue

          // Calculate author similarity
          const targetAuthors =
            target.author?.map((a) => `${a.family || ""}`.toLowerCase().trim()).filter(Boolean) || []

          let authorScore = 0

          if (sourceAuthors.length > 0 && targetAuthors.length > 0) {
            // Check if first author matches
            const firstAuthorMatch = sourceAuthors[0] === targetAuthors[0]

            // Count common authors
            const targetAuthorSet = new Set(targetAuthors)
            let commonAuthors = 0

            for (const author of sourceAuthors) {
              if (targetAuthorSet.has(author)) {
                commonAuthors++
              }
            }

            // Weight first author match more heavily
            authorScore =
              (firstAuthorMatch ? 0.6 : 0) +
              (0.4 * commonAuthors) / Math.max(sourceAuthors.length, targetAuthors.length)
          }

          // Combined score (weighted more towards title)
          const combinedScore = titleScore * 0.7 + authorScore * 0.3

          // Update best match if this is better
          if (combinedScore > bestTitleScore * 0.7 + bestAuthorScore * 0.3) {
            bestMatch = target
            bestTitleScore = titleScore
            bestAuthorScore = authorScore
          }
        }

        // If we found a good match, add it to results
        if (bestMatch) {
          // Determine confidence level based on scores
          let confidenceLevel: ConfidenceLevel = "Low"

          const combinedScore = bestTitleScore * 0.7 + bestAuthorScore * 0.3

          if (combinedScore > 0.9) {
            confidenceLevel = "High"
          } else if (combinedScore > 0.7) {
            confidenceLevel = "Medium"
          }

          console.log(
            `Basic matching found ${sourceType}->${targetType} match with title score ${bestTitleScore.toFixed(2)}, author score ${bestAuthorScore.toFixed(2)}, confidence ${confidenceLevel}`,
          )

          matches.push({
            source: convertToPub(source),
            match: convertToPub(bestMatch),
            confidenceLevel: confidenceLevel,
          })
        } else {
          // No good match found for this source
          console.log(`No good match found for ${sourceType}: ${sourceTitle.substring(0, 50)}...`)
          matches.push({
            source: convertToPub(source),
            confidenceLevel: "Low",
          })
        }
      }
    }

    // Try both directions: preprints->articles AND articles->preprints
    if (preprints.length > 0 && articles.length > 0) {
      findMatches(preprints, articles, "preprint", "article")
      findMatches(articles, preprints, "article", "preprint")
    } else {
      // If we only have one type, add them as unmatched
      const allWorks = [...preprints, ...articles]
      for (const work of allWorks) {
        matches.push({
          source: convertToPub(work),
          confidenceLevel: "Low",
        })
      }
    }

    console.log(`Basic matching completed with ${matches.length} total matches`)
    return matches
  } catch (error) {
    console.error("Error in basic matching:", error)
    throw error
  }
}

// New timeout-aware version of fuzzy matching
async function performFuzzyMatchingWithTimeout(
  query: string,
  works: CrossRefWork[],
  timeoutMs: number,
): Promise<ArticleMatch[]> {
  try {
    console.log(`=== Starting performFuzzyMatchingWithTimeout with ${timeoutMs}ms timeout ===`)

    // Separate preprints and articles
    const preprints = works.filter((w) => w.type === "posted-content")
    const articles = works.filter((w) => w.type === "journal-article")

    console.log(`Found ${preprints.length} preprints and ${articles.length} articles for fuzzy matching`)

    // If we don't have both preprints and articles, return basic results
    if (preprints.length === 0 || articles.length === 0) {
      console.log("Not enough preprints or articles for matching, returning basic results")
      return works.slice(0, 5).map((work) => ({
        source: safeConvertToPub(work),
        confidenceLevel: "Low",
      }))
    }

    // Check if OpenAI API key is available
    if (!OPENAI_API_KEY) {
      console.warn("OpenAI API key is missing. Using basic matching instead.")
      return performBasicMatching(works)
    }

    // Limit the number of works to process to avoid timeout
    const maxWorksPerType = 5
    const limitedPreprints = preprints.slice(0, maxWorksPerType)
    const limitedArticles = articles.slice(0, maxWorksPerType)

    console.log(
      `Limited to ${limitedPreprints.length} preprints and ${limitedArticles.length} articles for LLM processing`,
    )

    // Prepare simplified data for LLM (less verbose to reduce token count)
    const preprintsData = limitedPreprints.map((work) => ({
      title: work.title?.[0] || "Unknown Title",
      authors: work.author
        ?.slice(0, 3)
        .map((a) => `${a.family || ""}`)
        .filter(Boolean) || ["Unknown"],
      doi: work.DOI,
      year: work.published?.["date-parts"]?.[0]?.[0],
    }))

    const articlesData = limitedArticles.map((work) => ({
      title: work.title?.[0] || "Unknown Title",
      authors: work.author
        ?.slice(0, 3)
        .map((a) => `${a.family || ""}`)
        .filter(Boolean) || ["Unknown"],
      doi: work.DOI,
      year: work.published?.["date-parts"]?.[0]?.[0],
    }))

    // Simplified prompt to reduce processing time
    const prompt = `Find matches between preprints and articles. Return JSON array only.

Query: "${query}"

Preprints: ${JSON.stringify(preprintsData)}
Articles: ${JSON.stringify(articlesData)}

Return format:
[{"preprint":{"doi":"...","title":"..."},"article":{"doi":"...","title":"..."},"confidenceLevel":"High|Medium|Low"}]

Only include High/Medium confidence matches. Be concise.`

    console.log("Sending simplified request to LLM for fuzzy matching")

    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("LLM request timed out")), timeoutMs)
    })

    // Race the LLM call against the timeout
    const llmPromise = generateText({
      model: openai("gpt-4o-mini", { apiKey: OPENAI_API_KEY }), // Use faster model
      prompt: prompt,
      maxTokens: 2000, // Limit response size
    })

    const { text } = await Promise.race([llmPromise, timeoutPromise])

    // Parse LLM response
    const startIndex = text.indexOf("[")
    const endIndex = text.lastIndexOf("]")

    if (startIndex === -1 || endIndex === -1) {
      console.warn("Could not find JSON array in LLM response")
      return performBasicMatching(works)
    }

    const jsonStr = text.substring(startIndex, endIndex + 1)

    try {
      const llmMatches = JSON.parse(jsonStr)

      if (!Array.isArray(llmMatches)) {
        console.warn("LLM response is not an array")
        throw new Error("Invalid LLM response format")
      }

      console.log(`LLM returned ${llmMatches.length} potential matches`)

      // Convert LLM response to our ArticleMatch format
      const matches: ArticleMatch[] = []

      for (const match of llmMatches) {
        try {
          if (match.preprint?.doi && match.article?.doi) {
            // Find the original works to get full details
            const preprintWork = preprints.find((w) => w.DOI === match.preprint.doi)
            const articleWork = articles.find((w) => w.DOI === match.article.doi)

            if (preprintWork && articleWork) {
              matches.push({
                source: convertToPub(preprintWork),
                match: convertToPub(articleWork),
                confidenceLevel: match.confidenceLevel,
              })
            }
          }
        } catch (e) {
          console.warn("Error converting LLM match:", e)
        }
      }

      console.log(`Converted ${matches.length} LLM matches to ArticleMatch format`)
      return matches
    } catch (error) {
      console.error("Error parsing LLM response:", error)
      return performBasicMatching(works)
    }
  } catch (error) {
    console.error("Error in performFuzzyMatchingWithTimeout:", error)

    if (error instanceof Error && error.message.includes("timed out")) {
      console.log("LLM request timed out, falling back to basic matching")
    }

    // Fallback to basic matching
    return performBasicMatching(works)
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
