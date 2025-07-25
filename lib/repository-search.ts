"use server"

import type { ResearchNode, ResearchLink } from "./network-service"

// Interface for a dataset from a repository
export interface RepositoryDataset {
  id: string
  title: string
  authors: string[]
  repository: string
  url: string
  publicationDate?: string
  doi?: string
  description?: string
}

// Interface for repository search results
export interface RepositorySearchResults {
  datasets: RepositoryDataset[]
  source: string
}

// Function to search DataDryad for datasets
export async function searchDataDryad(searchTerm: string): Promise<RepositorySearchResults> {
  try {
    console.log(`=== DataDryad Search Debug ===`)
    console.log(`Original search term: "${searchTerm}"`)

    // Clean up the search term - focus on meaningful words
    const cleanedSearch = searchTerm
      .replace(/[^\w\s]/g, " ") // Replace non-word chars with spaces
      .replace(/\s+/g, " ") // Normalize spaces
      .trim()

    console.log(`Cleaned search term: "${cleanedSearch}"`)

    // Try a more focused search strategy
    const searchQueries = []

    // First, try the whole cleaned title
    if (cleanedSearch.trim().length > 0) {
      searchQueries.push(cleanedSearch.trim())
    }

    // If that doesn't work, try just the first 6 words
    const words = cleanedSearch.split(" ").filter((word) => word.length > 2)
    if (words.length > 6) {
      const firstSixWords = words.slice(0, 6).join(" ")
      if (firstSixWords !== cleanedSearch.trim()) {
        searchQueries.push(firstSixWords)
      }
    }

    console.log(`Search queries to try:`, searchQueries)

    const allResults: RepositoryDataset[] = []

    // Try each search query
    for (const searchQuery of searchQueries) {
      if (searchQuery.trim().length === 0) continue

      try {
        console.log(`Trying search query: "${searchQuery}"`)

        const encodedQuery = encodeURIComponent(searchQuery)
        const url = `https://datadryad.org/api/v2/search?q=${encodedQuery}&per_page=20`

        console.log(`DataDryad API URL: ${url}`)

        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
            "User-Agent": "OpenScienceDataMatcher/1.0 (paul@elifetechnology.org)",
          },
        })

        console.log(`Response status: ${response.status}`)

        if (!response.ok) {
          console.warn(`DataDryad API error for query "${searchQuery}": ${response.status}`)
          continue // Try next query
        }

        const data = await response.json()
        console.log(`Raw API response structure:`, {
          hasEmbedded: !!data._embedded,
          embeddedKeys: data._embedded ? Object.keys(data._embedded) : [],
          hasStashDatasets: !!(data._embedded && data._embedded["stash:datasets"]),
          datasetCount: data._embedded?.["stash:datasets"]?.length || 0,
          totalResults: data.total || 0,
        })

        // Log the full structure for debugging
        if (data._embedded) {
          console.log(`_embedded keys:`, Object.keys(data._embedded))
          if (data._embedded["stash:datasets"]) {
            console.log(`Found stash:datasets with ${data._embedded["stash:datasets"].length} items`)
          }
        }

        // Process the search results - FIXED: using "stash:datasets" instead of "stash$datasets"
        if (data._embedded && Array.isArray(data._embedded["stash:datasets"])) {
          console.log(`Found ${data._embedded["stash:datasets"].length} datasets for query "${searchQuery}"`)

          data._embedded["stash:datasets"].forEach((dataset: any, index: number) => {
            try {
              console.log(`Processing dataset ${index + 1}:`, {
                id: dataset.id,
                title: dataset.title?.substring(0, 100) + "...",
                hasAuthors: !!dataset.authors,
                authorCount: dataset.authors?.length || 0,
                hasIdentifier: !!dataset.identifier,
                identifierType: dataset.identifier?.identifier,
                identifier: dataset.identifier?.identifier,
                hasSharingLink: !!dataset.sharingLink,
                sharingLink: dataset.sharingLink,
                hasAbstract: !!dataset.abstract,
              })

              // Extract authors - handle different possible structures
              let authors = ["Unknown Author"]
              if (dataset.authors && Array.isArray(dataset.authors)) {
                authors = dataset.authors
                  .map((author: any) => {
                    // Handle different author formats
                    if (typeof author === "string") {
                      return author.trim()
                    } else if (author.firstName || author.lastName) {
                      const firstName = author.firstName || ""
                      const lastName = author.lastName || ""
                      return `${firstName} ${lastName}`.trim()
                    } else if (author.given || author.family) {
                      const given = author.given || ""
                      const family = author.family || ""
                      return `${given} ${family}`.trim()
                    }
                    return null
                  })
                  .filter((name: string | null) => name && name.length > 0)

                if (authors.length === 0) {
                  authors = ["Unknown Author"]
                }
              }

              // Extract DOI - check multiple possible locations
              let doi: string | undefined = undefined
              if (dataset.identifier?.identifierType === "DOI") {
                doi = dataset.identifier.identifier
              } else if (dataset.doi) {
                doi = dataset.doi
              }

              // Create dataset URL - prefer sharingLink, fall back to other options
              let datasetUrl = dataset.sharingLink
              if (!datasetUrl && dataset._links?.self?.href) {
                datasetUrl = dataset._links.self.href
              }
              if (!datasetUrl && dataset.id) {
                datasetUrl = `https://datadryad.org/stash/dataset/${dataset.id}`
              }

              // Extract publication date
              let publicationDate: string | undefined = undefined
              if (dataset.publicationDate) {
                publicationDate = dataset.publicationDate
              } else if (dataset.datePublished) {
                publicationDate = dataset.datePublished
              }

              // Create a repository dataset object
              const repositoryDataset: RepositoryDataset = {
                id: dataset.id || `dryad-${index}`,
                title: dataset.title || "Unknown Title",
                authors,
                repository: "DataDryad",
                url: datasetUrl || `https://datadryad.org/stash/dataset/${dataset.id}`,
                publicationDate,
                doi,
                description: dataset.abstract || dataset.description,
              }

              console.log(`Created dataset object:`, {
                id: repositoryDataset.id,
                title: repositoryDataset.title.substring(0, 100) + "...",
                authors: repositoryDataset.authors,
                doi: repositoryDataset.doi,
                url: repositoryDataset.url,
                repository: repositoryDataset.repository,
              })

              allResults.push(repositoryDataset)
            } catch (error) {
              console.error(`Error processing DataDryad dataset ${index}:`, error)
              console.error(`Dataset data:`, dataset)
            }
          })
        } else {
          console.log(`No datasets found in API response for query "${searchQuery}"`)
          console.log(`Response structure:`, {
            hasEmbedded: !!data._embedded,
            embeddedKeys: data._embedded ? Object.keys(data._embedded) : [],
            fullResponse: JSON.stringify(data, null, 2).substring(0, 500) + "...",
          })
        }

        // If we found some good results, we can stop trying more queries
        if (allResults.length >= 3) {
          console.log(`Found ${allResults.length} datasets, stopping search`)
          break
        }
      } catch (error) {
        console.error(`Error with DataDryad query "${searchQuery}":`, error)
        continue // Try next query
      }
    }

    console.log(`=== DataDryad Search Complete ===`)
    console.log(`Total datasets found: ${allResults.length}`)

    if (allResults.length > 0) {
      allResults.forEach((dataset, index) => {
        console.log(`Final dataset ${index + 1}:`, {
          id: dataset.id,
          title: dataset.title,
          authors: dataset.authors,
          repository: dataset.repository,
          url: dataset.url,
          doi: dataset.doi,
        })
      })
    }

    return {
      datasets: allResults,
      source: "DataDryad",
    }
  } catch (error) {
    console.error("Error in searchDataDryad:", error)
    return {
      datasets: [],
      source: "DataDryad",
    }
  }
}

// Function to search Figshare using the public API
export async function searchFigshare(
  searchTerm: string,
  anchorNode?: { title: string; authors: string[] },
): Promise<RepositorySearchResults> {
  try {
    console.log(`=== Figshare Search Debug ===`)
    console.log(`Original search term: "${searchTerm}"`)

    // Clean up the search term - focus on meaningful words
    const cleanedSearch = searchTerm
      .replace(/[^\w\s]/g, " ") // Replace non-word chars with spaces
      .replace(/\s+/g, " ") // Normalize spaces
      .trim()

    console.log(`Cleaned search term: "${cleanedSearch}"`)

    // Try a more focused search strategy
    const searchQueries = []

    // Create enhanced search terms that include author information
    if (anchorNode?.authors && anchorNode.authors.length > 0) {
      const firstAuthor = anchorNode.authors[0]
      // Add search query with author name
      searchQueries.push(`${cleanedSearch} ${firstAuthor}`)
    }

    // First, try the whole cleaned title
    if (cleanedSearch.trim().length > 0) {
      searchQueries.push(cleanedSearch.trim())
    }

    // If that doesn't work, try just the first 6 words
    const words = cleanedSearch.split(" ").filter((word) => word.length > 2)
    if (words.length > 6) {
      const firstSixWords = words.slice(0, 6).join(" ")
      if (firstSixWords !== cleanedSearch.trim()) {
        searchQueries.push(firstSixWords)
      }
    }

    console.log(`Search queries to try:`, searchQueries)

    const allResults: RepositoryDataset[] = []

    // Try each search query
    for (const searchQuery of searchQueries) {
      if (searchQuery.trim().length === 0) continue

      try {
        console.log(`Trying Figshare search query: "${searchQuery}"`)

        // Use the POST endpoint as documented
        const url = "https://api.figshare.com/v2/articles/search"

        // Create the request body according to the API documentation
        const requestBody = {
          search_for: searchQuery,
          page_size: 20,
          page: 1,
        }

        console.log(`Figshare API URL: ${url}`)
        console.log(`Request body:`, requestBody)

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "OpenScienceDataMatcher/1.0 (paul@elifetechnology.org)",
          },
          body: JSON.stringify(requestBody),
        })

        console.log(`Figshare response status: ${response.status}`)

        if (!response.ok) {
          console.warn(`Figshare API error for query "${searchQuery}": ${response.status}`)
          const errorText = await response.text()
          console.warn("Figshare error response:", errorText)
          continue // Try next query
        }

        const data = await response.json()
        console.log(`Figshare response structure:`, {
          hasResults: Array.isArray(data),
          resultCount: Array.isArray(data) ? data.length : 0,
          firstItemKeys: Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : [],
        })

        // The response should be an array of articles
        if (Array.isArray(data)) {
          console.log(`Found ${data.length} Figshare articles for query "${searchQuery}"`)

          // Process each article and filter by title similarity
          for (const article of data) {
            try {
              console.log(`Processing Figshare article:`, {
                id: article.id,
                title: article.title?.substring(0, 100) + "...",
                hasAuthors: !!article.authors,
                authorCount: article.authors?.length || 0,
                doi: article.doi,
                url: article.url,
                published_date: article.published_date,
              })

              // Filter by title similarity - only include if there's reasonable overlap
              const titleSimilarity = await calculateTitleSimilarity(searchQuery, article.title || "")
              console.log(
                `Title similarity score: ${titleSimilarity.toFixed(2)} for article: ${article.title?.substring(0, 50)}...`,
              )

              // Only include articles with good title similarity to reduce noise
              if (titleSimilarity < 0.5) {
                console.log(`Skipping article due to low title similarity: ${titleSimilarity.toFixed(2)}`)
                continue
              }

              // Extract authors
              let authors = ["Unknown Author"]
              if (article.authors && Array.isArray(article.authors)) {
                authors = article.authors
                  .map((author: any) => {
                    return `${author.full_name || "Unknown Author"}`.trim()
                  })
                  .filter(Boolean)

                if (authors.length === 0) {
                  authors = ["Unknown Author"]
                }
              }

              // Format publication date
              let publicationDate: string | undefined = undefined
              if (article.published_date) {
                publicationDate = article.published_date
              }

              // Create dataset URL
              const datasetUrl = article.url || `https://figshare.com/articles/${article.id}`

              // Create a repository dataset object
              const repositoryDataset: RepositoryDataset = {
                id: `figshare-${article.id}`,
                title: article.title || "Unknown Title",
                authors,
                repository: "Figshare",
                url: datasetUrl,
                publicationDate,
                doi: article.doi,
                description: article.description,
              }

              console.log(`Created Figshare dataset object:`, {
                id: repositoryDataset.id,
                title: repositoryDataset.title.substring(0, 100) + "...",
                authors: repositoryDataset.authors,
                doi: repositoryDataset.doi,
                url: repositoryDataset.url,
                repository: repositoryDataset.repository,
              })

              allResults.push(repositoryDataset)
            } catch (error) {
              console.error(`Error processing Figshare article:`, error)
            }
          }
        } else {
          console.log(`Unexpected Figshare response format:`, data)
        }

        // If we found some good results, we can stop trying more queries
        if (allResults.length >= 3) {
          console.log(`Found ${allResults.length} Figshare datasets, stopping search`)
          break
        }
      } catch (error) {
        console.error(`Error with Figshare query "${searchQuery}":`, error)
        continue // Try next query
      }
    }

    console.log(`=== Figshare Search Complete ===`)
    console.log(`Total Figshare datasets found: ${allResults.length}`)

    return {
      datasets: allResults,
      source: "Figshare",
    }
  } catch (error) {
    console.error("Error in searchFigshare:", error)
    return {
      datasets: [],
      source: "Figshare",
    }
  }
}

// Function to search all repositories and combine results
export async function searchAllRepositories(
  searchTerm: string,
  anchorNode?: { title: string; authors: string[] },
): Promise<RepositoryDataset[]> {
  console.log(`=== Searching All Repositories for: "${searchTerm}" ===`)

  const allDatasets: RepositoryDataset[] = []

  try {
    // Search DataDryad
    const dryadResults = await searchDataDryad(searchTerm)
    if (dryadResults.datasets.length > 0) {
      console.log(`Adding ${dryadResults.datasets.length} datasets from DataDryad`)
      allDatasets.push(...dryadResults.datasets)
    }

    // Search Figshare with anchor node information for better filtering
    const figshareResults = await searchFigshare(searchTerm, anchorNode)
    if (figshareResults.datasets.length > 0) {
      console.log(`Adding ${figshareResults.datasets.length} datasets from Figshare`)
      allDatasets.push(...figshareResults.datasets)
    }

    console.log(`=== Repository Search Complete ===`)
    console.log(`Total datasets found across all repositories: ${allDatasets.length}`)

    return allDatasets
  } catch (error) {
    console.error("Error searching repositories:", error)
    return allDatasets
  }
}

// Function to calculate similarity between a research paper title and a dataset title
export async function calculateTitleSimilarity(paperTitle: string, datasetTitle: string): Promise<number> {
  if (!paperTitle || !datasetTitle) return 0

  // Normalize the strings
  const normalizePaperTitle = paperTitle
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  const normalizeDatasetTitle = datasetTitle
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  // Split into words (only keeping meaningful words)
  const paperWords = normalizePaperTitle.split(" ").filter((w) => w.length > 3)
  const datasetWords = normalizeDatasetTitle.split(" ").filter((w) => w.length > 3)

  // Count common words
  const paperWordSet = new Set(paperWords)
  let commonWords = 0

  for (const word of datasetWords) {
    if (paperWordSet.has(word)) {
      commonWords++
    }
  }

  // Calculate similarity score
  return commonWords / Math.max(paperWords.length, datasetWords.length)
}

// Function to convert repository datasets to research nodes and links
export async function datasetsToNodesAndLinks(
  datasets: RepositoryDataset[],
  sourceNodeId: string,
  minSimilarity = 0.0, // Lowered from 0.2 to include more results
): Promise<{ nodes: ResearchNode[]; links: ResearchLink[] }> {
  const nodes: ResearchNode[] = []
  const links: ResearchLink[] = []

  console.log(`Converting ${datasets.length} datasets to nodes and links`)

  datasets.forEach((dataset, index) => {
    console.log(`Converting dataset ${index + 1}: ${dataset.title.substring(0, 50)}...`)

    const node: ResearchNode = {
      id: `dataset:${dataset.repository}:${dataset.id}`,
      idType: dataset.doi ? "doi" : "uri",
      doi: dataset.doi,
      uri: dataset.url,
      title: dataset.title,
      authors: dataset.authors,
      type: "dataset",
      typeLabel: "Dataset",
      publicationDate: dataset.publicationDate,
      isAnchor: false,
      repository: dataset.repository,
    }

    nodes.push(node)

    links.push({
      source: sourceNodeId,
      target: node.id,
      type: "related-dataset",
      label: "Related Dataset",
    })

    console.log(`Created node: ${node.id} with title: ${node.title}`)
  })

  console.log(`Created ${nodes.length} nodes and ${links.length} links`)
  return { nodes, links }
}
