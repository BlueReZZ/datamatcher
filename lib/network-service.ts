"use server"
import { getTypeLabel } from "./crossref-types"
import { formatRelationType } from "./format-relation-type"
import { fetchUriMetadata } from "./uri-service"
import { searchArticles } from "./search-service"

const CROSSREF_API_URL = "https://api.crossref.org/works"

export interface ResearchNode {
  id: string
  doi?: string
  uri?: string
  idType: string // Type of identifier (doi, uri, etc.)
  title: string
  authors: string[]
  type: string
  typeLabel: string
  subType?: string
  publicationDate?: string
  publisher?: string
  containerTitle?: string
  isAnchor?: boolean
  statusCode?: number // HTTP status code for URI resources
  fetchedTitle?: string | null // Title fetched from URI
  fetchError?: string // Error message if URI fetch failed
  repository?: string // Added: Repository name for dataset nodes
  metadata?: {
    confidenceLevel?: string
    matchType?: string
  }
}

export interface ResearchLink {
  source: string
  target: string
  type: string
  label: string // Human-readable label for the relation type
}

export interface ResearchNetwork {
  nodes: ResearchNode[]
  links: ResearchLink[]
}

// Function to fetch a publication by DOI
async function fetchPublicationByDOI(doi: string): Promise<any> {
  try {
    console.log(`Fetching publication details for DOI: ${doi}`)
    const response = await fetch(`${CROSSREF_API_URL}/${encodeURIComponent(doi)}`, {
      headers: {
        "User-Agent": "OpenScienceDataMatcher/1.0 (paul@elifetechnology.org)",
      },
    })

    if (!response.ok) {
      console.warn(`Failed to fetch publication details for DOI ${doi}: ${response.status}`)
      return null
    }

    const data = await response.json()
    return data.message
  } catch (error) {
    console.error(`Error fetching publication details for DOI ${doi}:`, error)
    return null
  }
}

// Function to convert CrossRef work to ResearchNode
async function convertToResearchNode(
  work: any,
  isAnchor = false,
  metadata?: { confidenceLevel?: string; matchType?: string },
): Promise<ResearchNode> {
  try {
    // Extract title
    const title = Array.isArray(work.title) && work.title.length > 0 ? work.title[0] : "Unknown Title"

    // Extract authors
    const authors =
      Array.isArray(work.author) && work.author.length > 0
        ? work.author.map((a: any) => {
            try {
              return `${a.given || ""} ${a.family || ""}`.trim() || "Unknown Author"
            } catch (e) {
              return "Unknown Author"
            }
          })
        : ["Unknown Author"]

    // Extract publication date
    const dateParts = work.published?.["date-parts"]?.[0]
    let publicationDate: string | undefined = undefined
    if (dateParts && dateParts.length > 0) {
      const year = dateParts[0]
      const month = dateParts.length > 1 ? dateParts[1].toString().padStart(2, "0") : "01"
      const day = dateParts.length > 2 ? dateParts[2].toString().padStart(2, "0") : "01"
      publicationDate = `${year}-${month}-${day}`
    }

    // Extract container title (journal name)
    const containerTitle =
      Array.isArray(work["container-title"]) && work["container-title"].length > 0
        ? work["container-title"][0]
        : undefined

    // Extract sub-type for posted-content
    let subType: string | undefined = undefined
    if (work.type === "posted-content" && work.subtype) {
      subType = work.subtype
    }

    // Get type label, using sub-type if available
    const typeLabel = await getTypeLabel(work.type, subType)

    return {
      id: work.DOI, // Use the DOI as the ID (we'll handle uniqueness in the visualization)
      doi: work.DOI,
      idType: "doi",
      title,
      authors,
      type: work.type,
      typeLabel,
      subType,
      publicationDate,
      publisher: work.publisher,
      containerTitle,
      isAnchor,
      metadata,
    }
  } catch (error) {
    console.error("Error converting work to research node:", error)
    return {
      id: work.DOI || "unknown",
      doi: work.DOI || "unknown",
      idType: "doi",
      title: "Unknown Title",
      authors: ["Unknown Author"],
      type: "unknown",
      typeLabel: "Unknown Type",
      isAnchor,
      metadata,
    }
  }
}

// Function to create a placeholder node for non-DOI identifiers
async function createPlaceholderNode(id: string, idType: string, label?: string): Promise<ResearchNode> {
  // Default title before any fetching
  let title = label || (idType === "uri" ? `Resource at ${id}` : `External Resource (${idType}): ${id}`)
  let statusCode: number | undefined = undefined
  let fetchedTitle: string | null = null
  let fetchError: string | undefined = undefined

  // For URI type, try to fetch the title
  if (idType === "uri") {
    try {
      const metadata = await fetchUriMetadata(id)
      statusCode = metadata.statusCode
      fetchedTitle = metadata.title
      fetchError = metadata.error

      // If we got a title from the URI, use it
      if (metadata.title) {
        title = metadata.title
      }
    } catch (error) {
      console.error(`Error fetching URI metadata for ${id}:`, error)
      fetchError = error instanceof Error ? error.message : "Unknown error"
    }
  }

  return {
    id: `${idType}:${id}`, // Create a unique ID combining the type and ID
    [idType]: id, // Add the ID with its type as the property name (e.g., uri: "http://...")
    idType,
    title,
    authors: ["Unknown Author"],
    type: "external-resource",
    typeLabel: idType === "uri" ? "External Resource" : `External ${idType.toUpperCase()}`,
    isAnchor: false,
    statusCode,
    fetchedTitle,
    fetchError,
  }
}

// Function to extract all relation types from a work
function extractRelations(work: any): { id: string; idType: string; type: string; label: string }[] {
  const relations: { id: string; idType: string; type: string; label: string }[] = []

  if (!work.relation) return relations

  // Process each relation type
  Object.entries(work.relation).forEach(([relationType, items]: [string, any]) => {
    if (Array.isArray(items)) {
      items.forEach((item) => {
        // Handle different ID types
        if (item["id-type"] && item.id) {
          relations.push({
            id: item.id,
            idType: item["id-type"],
            type: relationType,
            label: formatRelationType(relationType),
          })
        }
      })
    }
  })

  return relations
}

// Enhanced function to search for bidirectional matches
async function searchForBidirectionalMatches(
  node: ResearchNode,
  processedIDs: Map<string, string>,
): Promise<{ nodes: ResearchNode[]; links: ResearchLink[] }> {
  const newNodes: ResearchNode[] = []
  const newLinks: ResearchLink[] = []

  try {
    // Create a search query from the node's metadata
    const searchQuery = `${node.title} ${node.authors[0]}`

    console.log(`Searching for bidirectional matches for: ${node.title.substring(0, 50)}...`)

    // Use the search algorithm to find potential matches
    const matches = await searchArticles(searchQuery)

    // Process the matches
    for (const match of matches) {
      // Check if we found a medium or higher confidence match (changed from high-confidence only)
      if (
        match.match &&
        (match.confidenceLevel === "High" ||
          match.confidenceLevel === "Very High" ||
          match.confidenceLevel === "Medium")
      ) {
        const matchDoi = match.match.doi
        if (matchDoi) {
          const relationKey = `doi:${matchDoi.toLowerCase()}`

          // Skip if we already have this node
          if (processedIDs.has(relationKey)) continue

          // Create a new node for the match
          const matchNode = await convertToResearchNode(
            {
              DOI: matchDoi,
              title: [match.match.title],
              author: match.match.authors.map((author) => {
                const parts = author.split(" ")
                return {
                  given: parts.slice(0, -1).join(" "),
                  family: parts[parts.length - 1],
                }
              }),
              published: match.match.publicationDate
                ? {
                    "date-parts": [match.match.publicationDate.split("-").map(Number)],
                  }
                : undefined,
              type:
                match.match.originalType || (match.match.type === "preprint" ? "posted-content" : "journal-article"),
              publisher: match.match.publisher,
              "container-title": match.match.containerTitle ? [match.match.containerTitle] : undefined,
              abstract: match.match.abstract,
              institution: match.match.institution ? [{ name: match.match.institution }] : undefined,
            },
            false,
            {
              confidenceLevel: match.confidenceLevel,
              matchType: "algorithmic",
            },
          )

          newNodes.push(matchNode)
          processedIDs.set(relationKey, matchNode.id)

          // Add a link between the original node and the match
          newLinks.push({
            source: node.id,
            target: matchNode.id,
            type: "algorithmic-match",
            label: `Algorithmic Match (${match.confidenceLevel})`,
          })

          console.log(`Added algorithmic match: ${match.match.title.substring(0, 50)}...`)
        }
      }

      // Also check if the source publication is different from our anchor and is a good match
      if (
        match.source &&
        match.source.doi &&
        match.source.doi !== node.doi &&
        (match.confidenceLevel === "High" ||
          match.confidenceLevel === "Very High" ||
          match.confidenceLevel === "Medium")
      ) {
        const sourceDoi = match.source.doi
        const relationKey = `doi:${sourceDoi.toLowerCase()}`

        // Skip if we already have this node
        if (processedIDs.has(relationKey)) continue

        // Create a new node for the source match
        const sourceNode = await convertToResearchNode(
          {
            DOI: sourceDoi,
            title: [match.source.title],
            author: match.source.authors.map((author) => {
              const parts = author.split(" ")
              return {
                given: parts.slice(0, -1).join(" "),
                family: parts[parts.length - 1],
              }
            }),
            published: match.source.publicationDate
              ? {
                  "date-parts": [match.source.publicationDate.split("-").map(Number)],
                }
              : undefined,
            type:
              match.source.originalType || (match.source.type === "preprint" ? "posted-content" : "journal-article"),
            publisher: match.source.publisher,
            "container-title": match.source.containerTitle ? [match.source.containerTitle] : undefined,
            abstract: match.source.abstract,
            institution: match.source.institution ? [{ name: match.source.institution }] : undefined,
          },
          false,
          {
            confidenceLevel: match.confidenceLevel,
            matchType: "algorithmic",
          },
        )

        newNodes.push(sourceNode)
        processedIDs.set(relationKey, sourceNode.id)

        // Add a link between the original node and the source match
        newLinks.push({
          source: node.id,
          target: sourceNode.id,
          type: "algorithmic-match",
          label: `Algorithmic Match (${match.confidenceLevel})`,
        })

        console.log(`Added algorithmic source match: ${match.source.title.substring(0, 50)}...`)
      }
    }
  } catch (error) {
    console.error(`Error finding bidirectional matches for node ${node.id}:`, error)
    // Continue with other nodes even if one fails
  }

  return { nodes: newNodes, links: newLinks }
}

// Function to enhance network using the matching algorithm
async function enhanceNetworkWithMatching(
  nodes: ResearchNode[],
  links: ResearchLink[],
  processedIDs: Map<string, string>,
  maxAdditionalNodes = 20,
): Promise<{ nodes: ResearchNode[]; links: ResearchLink[] }> {
  console.log("Enhancing network with bidirectional matching algorithm...")

  const enhancedNodes = [...nodes]
  const enhancedLinks = [...links]
  let nodeCount = 0

  // For each DOI node, try to find matches using the search algorithm
  for (const node of nodes) {
    if (nodeCount >= maxAdditionalNodes) {
      console.log(`Reached maximum of ${maxAdditionalNodes} additional nodes from matching.`)
      break
    }

    if (node.idType === "doi" && node.title && node.authors.length > 0) {
      try {
        // Search for bidirectional matches
        const { nodes: newNodes, links: newLinks } = await searchForBidirectionalMatches(node, processedIDs)

        // Add the new nodes and links
        enhancedNodes.push(...newNodes)
        enhancedLinks.push(...newLinks)
        nodeCount += newNodes.length

        // Small delay to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`Error finding matches for node ${node.id}:`, error)
        // Continue with other nodes even if one fails
      }
    }
  }

  console.log(`Enhanced network with ${nodeCount} additional nodes from matching algorithm`)
  return { nodes: enhancedNodes, links: enhancedLinks }
}

// Function to enhance network with repository data
async function enhanceNetworkWithRepositoryData(
  nodes: ResearchNode[],
  links: ResearchLink[],
  processedIDs: Map<string, string>,
): Promise<{ nodes: ResearchNode[]; links: ResearchLink[] }> {
  console.log("=== Enhancing network with repository data ===")

  const enhancedNodes = [...nodes]
  const enhancedLinks = [...links]

  // Only search based on the anchor node
  const anchorNode = nodes.find((node) => node.isAnchor)
  if (!anchorNode || !anchorNode.title) {
    console.log("No anchor node found or anchor node has no title, skipping repository search.")
    return { nodes: enhancedNodes, links: enhancedLinks }
  }

  console.log(`Searching for repository data for anchor: "${anchorNode.title}"`)

  try {
    // Import the repository search function here to avoid circular dependencies
    const { searchAllRepositories, datasetsToNodesAndLinks } = await import("./repository-search")

    // Search all repositories for datasets matching the anchor node's title
    // Pass anchor node information for better search and filtering
    console.log(
      `Calling searchAllRepositories with title: "${anchorNode.title}" and authors: ${anchorNode.authors.join(", ")}`,
    )
    const datasets = await searchAllRepositories(anchorNode.title, {
      title: anchorNode.title,
      authors: anchorNode.authors,
    })

    console.log(`Repository search returned ${datasets.length} total datasets`)

    if (datasets.length > 0) {
      console.log(`Found ${datasets.length} datasets across repositories`)

      // Log each dataset found
      datasets.forEach((dataset, index) => {
        console.log(`Dataset ${index + 1}: "${dataset.title}" (${dataset.repository})`)
      })

      // Convert datasets to nodes and links
      const { nodes: datasetNodes, links: datasetLinks } = await datasetsToNodesAndLinks(datasets, anchorNode.id)

      console.log(`Created ${datasetNodes.length} dataset nodes and ${datasetLinks.length} dataset links`)

      // Add the new nodes and links
      enhancedNodes.push(...datasetNodes)
      enhancedLinks.push(...datasetLinks)

      // Add the nodes to processed IDs
      datasetNodes.forEach((node) => {
        processedIDs.set(`dataset:${node.id}`, node.id)
      })

      console.log(`Successfully added ${datasetNodes.length} dataset nodes to the network`)
    } else {
      console.log(`No datasets found for title: "${anchorNode.title}"`)
    }
  } catch (error) {
    console.error("Error enhancing network with repository data:", error)
    // Continue with the existing network if there's an error
  }

  console.log("=== Repository data enhancement complete ===")
  return { nodes: enhancedNodes, links: enhancedLinks }
}

// Function to expand network with second-level connections
async function expandSecondLevelConnections(
  nodes: ResearchNode[],
  links: ResearchLink[],
  processedIDs: Map<string, string>,
  maxAdditionalNodes = 30,
): Promise<{ nodes: ResearchNode[]; links: ResearchLink[] }> {
  console.log("=== Expanding network with second-level connections ===")

  const expandedNodes = [...nodes]
  const expandedLinks = [...links]
  let nodeCount = 0

  // Get all non-anchor DOI nodes to expand from
  const nodesToExpand = nodes.filter((node) => !node.isAnchor && node.idType === "doi" && node.doi)

  console.log(`Found ${nodesToExpand.length} nodes to expand second-level connections from`)

  for (const node of nodesToExpand) {
    if (nodeCount >= maxAdditionalNodes) {
      console.log(`Reached maximum of ${maxAdditionalNodes} additional nodes from second-level expansion.`)
      break
    }

    try {
      console.log(`Expanding second-level connections for: ${node.title.substring(0, 50)}...`)

      // Fetch the publication details for this node
      const nodeWork = await fetchPublicationByDOI(node.doi!)
      if (!nodeWork) {
        console.warn(`Could not fetch details for DOI: ${node.doi}`)
        continue
      }

      // Extract relations from this node
      const nodeRelations = extractRelations(nodeWork)
      console.log(`Found ${nodeRelations.length} relations for node: ${node.doi}`)

      // Process each relation
      for (const relation of nodeRelations) {
        if (nodeCount >= maxAdditionalNodes) {
          console.log(`Reached maximum nodes during second-level expansion.`)
          break
        }

        const relationKey = `${relation.idType}:${relation.id.toLowerCase()}`

        // Skip if we already have this node
        if (processedIDs.has(relationKey)) {
          // Add a link to the existing node if it doesn't already exist
          const existingNodeId = processedIDs.get(relationKey)
          if (existingNodeId) {
            const linkExists = expandedLinks.some(
              (link) =>
                (link.source === node.id && link.target === existingNodeId) ||
                (link.source === existingNodeId && link.target === node.id),
            )
            if (!linkExists) {
              expandedLinks.push({
                source: node.id,
                target: existingNodeId,
                type: relation.type,
                label: relation.label,
              })
            }
          }
          continue
        }

        // Handle different ID types
        if (relation.idType === "doi") {
          // For DOIs, fetch the publication details
          const relatedWork = await fetchPublicationByDOI(relation.id)
          if (relatedWork) {
            const relatedNode = await convertToResearchNode(relatedWork, false, {
              confidenceLevel: "High",
              matchType: "second-level",
            })
            expandedNodes.push(relatedNode)
            processedIDs.set(relationKey, relatedNode.id)
            nodeCount++

            // Add link using node IDs
            expandedLinks.push({
              source: node.id,
              target: relatedNode.id,
              type: relation.type,
              label: relation.label,
            })

            console.log(`Added second-level node: ${relatedNode.title.substring(0, 50)}...`)
          }
        } else {
          // For non-DOI identifiers, create a placeholder node
          const placeholderNode = await createPlaceholderNode(relation.id, relation.idType)
          expandedNodes.push(placeholderNode)
          processedIDs.set(relationKey, placeholderNode.id)
          nodeCount++

          // Add link using node IDs
          expandedLinks.push({
            source: node.id,
            target: placeholderNode.id,
            type: relation.type,
            label: relation.label,
          })

          console.log(`Added second-level placeholder: ${placeholderNode.title.substring(0, 30)}...`)
        }

        // Small delay to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    } catch (error) {
      console.error(`Error expanding second-level connections for node ${node.id}:`, error)
      // Continue with other nodes even if one fails
    }
  }

  console.log(`Added ${nodeCount} nodes from second-level expansion`)
  console.log("=== Second-level expansion complete ===")
  return { nodes: expandedNodes, links: expandedLinks }
}

// Main function to build the research network
export async function buildResearchNetwork(
  anchorDoi: string,
  relatedDoi?: string,
  useMatchingAlgorithm = false,
  useRepositoryData = false,
  expandSecondLevel = false,
): Promise<ResearchNetwork> {
  const nodes: ResearchNode[] = []
  const links: ResearchLink[] = []
  const processedIDs = new Map<string, string>() // Map of ID to node ID
  const maxRelatedNodes = 50 // Limit to prevent overwhelming visualization

  console.log(`=== Building Research Network ===`)
  console.log(`Anchor DOI: ${anchorDoi}`)
  console.log(`Related DOI: ${relatedDoi || "none"}`)
  console.log(`Use Matching Algorithm: ${useMatchingAlgorithm}`)
  console.log(`Use Repository Data: ${useRepositoryData}`)
  console.log(`Expand Second Level: ${expandSecondLevel}`)

  try {
    // Fetch the anchor publication
    const anchorWork = await fetchPublicationByDOI(anchorDoi)
    if (!anchorWork) {
      throw new Error(`Failed to fetch anchor publication: ${anchorDoi}`)
    }

    // Add anchor node
    const anchorNode = await convertToResearchNode(anchorWork, true)
    nodes.push(anchorNode)
    processedIDs.set(`doi:${anchorDoi.toLowerCase()}`, anchorNode.id) // Store with type prefix

    console.log(`Added anchor node: "${anchorNode.title}"`)

    // If we have a related DOI, add it first
    if (relatedDoi && relatedDoi.toLowerCase() !== anchorDoi.toLowerCase()) {
      const relatedWork = await fetchPublicationByDOI(relatedDoi)
      if (relatedWork) {
        const relatedNode = await convertToResearchNode(relatedWork, false, {
          confidenceLevel: "Very High",
          matchType: "metadata",
        })
        nodes.push(relatedNode)
        processedIDs.set(`doi:${relatedDoi.toLowerCase()}`, relatedNode.id)

        // Add link between anchor and related
        links.push({
          source: anchorNode.id,
          target: relatedNode.id,
          type: "confirmed-match",
          label: "Confirmed Match",
        })
      }
    }

    // Extract relations from anchor
    const anchorRelations = extractRelations(anchorWork)
    console.log(`Found ${anchorRelations.length} relations for anchor DOI: ${anchorDoi}`)

    // Process each relation, up to the maximum limit
    let nodeCount = 0
    for (const relation of anchorRelations) {
      if (nodeCount >= maxRelatedNodes) {
        console.log(`Reached maximum of ${maxRelatedNodes} related nodes. Stopping relation processing.`)
        break
      }

      const relationKey = `${relation.idType}:${relation.id.toLowerCase()}`

      if (!processedIDs.has(relationKey)) {
        // Handle different ID types
        if (relation.idType === "doi") {
          // For DOIs, fetch the publication details
          const relatedWork = await fetchPublicationByDOI(relation.id)
          if (relatedWork) {
            const relatedNode = await convertToResearchNode(relatedWork, false, {
              confidenceLevel: "Very High",
              matchType: "metadata",
            })
            nodes.push(relatedNode)
            processedIDs.set(relationKey, relatedNode.id)
            nodeCount++

            // Add link using node IDs
            links.push({
              source: anchorNode.id,
              target: relatedNode.id,
              type: relation.type,
              label: relation.label,
            })
          } else {
            // Skip adding this link since we couldn't fetch the related work
            console.warn(`Skipping link to ${relation.id} - could not fetch publication`)
          }
        } else {
          // For non-DOI identifiers, create a placeholder node
          const placeholderNode = await createPlaceholderNode(relation.id, relation.idType)
          nodes.push(placeholderNode)
          processedIDs.set(relationKey, placeholderNode.id)
          nodeCount++

          // Add link using node IDs
          links.push({
            source: anchorNode.id,
            target: placeholderNode.id,
            type: relation.type,
            label: relation.label,
          })
        }
      } else {
        // Find the existing node for this ID
        const existingNodeId = processedIDs.get(relationKey)
        if (existingNodeId) {
          links.push({
            source: anchorNode.id,
            target: existingNodeId,
            type: relation.type,
            label: relation.label,
          })
        }
      }
    }

    // If we have the related DOI, also extract its relations
    if (relatedDoi && relatedDoi.toLowerCase() !== anchorDoi.toLowerCase()) {
      const relatedWork = await fetchPublicationByDOI(relatedDoi)
      if (relatedWork) {
        const relatedNodeId = processedIDs.get(`doi:${relatedDoi.toLowerCase()}`)
        if (!relatedNodeId) {
          console.warn(`Related node not found for DOI: ${relatedDoi}`)
          return { nodes, links }
        }

        const relatedRelations = extractRelations(relatedWork)
        console.log(`Found ${relatedRelations.length} relations for related DOI: ${relatedDoi}`)

        // Process each relation, continuing the node count
        for (const relation of relatedRelations) {
          if (nodeCount >= maxRelatedNodes) {
            console.log(`Reached maximum of ${maxRelatedNodes} related nodes. Stopping relation processing.`)
            break
          }

          const relationKey = `${relation.idType}:${relation.id.toLowerCase()}`

          // Skip if it's the anchor or already processed
          if (relationKey === `doi:${anchorDoi.toLowerCase()}` || processedIDs.has(relationKey)) {
            // If it's already processed, just add a link to the existing node
            if (relationKey !== `doi:${anchorDoi.toLowerCase()}`) {
              const existingNodeId = processedIDs.get(relationKey)
              if (existingNodeId) {
                links.push({
                  source: relatedNodeId,
                  target: existingNodeId,
                  type: relation.type,
                  label: relation.label,
                })
              }
            }
            continue
          }

          // Handle different ID types
          if (relation.idType === "doi") {
            // For DOIs, fetch the publication details
            const relWork = await fetchPublicationByDOI(relation.id)
            if (relWork) {
              const relNode = await convertToResearchNode(relWork, false, {
                confidenceLevel: "Very High",
                matchType: "metadata",
              })
              nodes.push(relNode)
              processedIDs.set(relationKey, relNode.id)
              nodeCount++

              // Add link using node IDs
              links.push({
                source: relatedNodeId,
                target: relNode.id,
                type: relation.type,
                label: relation.label,
              })
            } else {
              // Skip adding this link since we couldn't fetch the related work
              console.warn(`Skipping link to ${relation.id} - could not fetch publication`)
            }
          } else {
            // For non-DOI identifiers, create a placeholder node
            const placeholderNode = await createPlaceholderNode(relation.id, relation.idType)
            nodes.push(placeholderNode)
            processedIDs.set(relationKey, placeholderNode.id)
            nodeCount++

            // Add link using node IDs
            links.push({
              source: relatedNodeId,
              target: placeholderNode.id,
              type: relation.type,
              label: relation.label,
            })
          }
        }
      }
    }

    console.log(`Built basic research network with ${nodes.length} nodes and ${links.length} links`)

    // Check if we have Very High confidence matches from metadata
    const hasVeryHighConfidence = nodes.some(
      (node) => node.metadata?.confidenceLevel === "Very High" && node.metadata?.matchType === "metadata",
    )

    if (hasVeryHighConfidence) {
      console.log("Very High confidence metadata matches found - skipping enhanced matching algorithm")
      useMatchingAlgorithm = false
    }

    // If requested, enhance the network using the matching algorithm
    if (useMatchingAlgorithm) {
      console.log("Enhancing with matching algorithm...")
      const enhanced = await enhanceNetworkWithMatching(nodes, links, processedIDs, 20)
      // Update our working set of nodes and links
      const enhancedNodes = enhanced.nodes
      const enhancedLinks = enhanced.links

      // If requested, further enhance with repository data
      if (useRepositoryData) {
        console.log("Further enhancing with repository data...")
        const withRepositoryData = await enhanceNetworkWithRepositoryData(enhancedNodes, enhancedLinks, processedIDs)
        console.log(`Final network: ${withRepositoryData.nodes.length} nodes, ${withRepositoryData.links.length} links`)
        return { nodes: withRepositoryData.nodes, links: withRepositoryData.links }
      }

      console.log(`Final network: ${enhancedNodes.length} nodes, ${enhancedLinks.length} links`)
      return { nodes: enhancedNodes, links: enhancedLinks }
    }

    // If only repository data is requested (without matching algorithm)
    if (useRepositoryData) {
      console.log("Enhancing with repository data only...")
      const withRepositoryData = await enhanceNetworkWithRepositoryData(nodes, links, processedIDs)
      console.log(`Final network: ${withRepositoryData.nodes.length} nodes, ${withRepositoryData.links.length} links`)
      return { nodes: withRepositoryData.nodes, links: withRepositoryData.links }
    }

    const withRepositoryData: { nodes: ResearchNode[]; links: ResearchLink[] } = { nodes: [], links: [] }
    const enhancedNodes: ResearchNode[] = []
    const enhancedLinks: ResearchLink[] = []

    // If requested, expand with second-level connections (this should be last)
    if (expandSecondLevel) {
      console.log("Expanding with second-level connections...")
      const withSecondLevel = await expandSecondLevelConnections(
        useRepositoryData ? withRepositoryData.nodes : useMatchingAlgorithm ? enhancedNodes : nodes,
        useRepositoryData ? withRepositoryData.links : useMatchingAlgorithm ? enhancedLinks : links,
        processedIDs,
      )
      console.log(`Final network: ${withSecondLevel.nodes.length} nodes, ${withSecondLevel.links.length} links`)
      return { nodes: withSecondLevel.nodes, links: withSecondLevel.links }
    }

    console.log(`Final network: ${nodes.length} nodes, ${links.length} links`)
    return { nodes, links }
  } catch (error) {
    console.error("Error building research network:", error)
    // Return at least the anchor node if we have it
    if (nodes.length > 0) {
      return { nodes, links }
    }
    throw error
  }
}
