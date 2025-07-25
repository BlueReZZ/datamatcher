// Cache for CrossRef types
let typeCache: Record<string, string> | null = null
let subTypeCache: Record<string, string> | null = null

// Function to fetch CrossRef types
export async function fetchCrossRefTypes(): Promise<Record<string, string>> {
  if (typeCache) {
    return typeCache
  }

  try {
    const response = await fetch("https://api.crossref.org/types")

    if (!response.ok) {
      throw new Error(`Failed to fetch CrossRef types: ${response.status}`)
    }

    const data = await response.json()

    // Create a mapping of type IDs to labels
    const typeMap: Record<string, string> = {}

    if (data.message && data.message.items) {
      data.message.items.forEach((item: any) => {
        if (item.id && item.label) {
          typeMap[item.id] = item.label
        }
      })
    }

    // Cache the result
    typeCache = typeMap
    return typeMap
  } catch (error) {
    console.error("Error fetching CrossRef types:", error)

    // Return a default mapping if the fetch fails
    return {
      "journal-article": "Journal Article",
      "posted-content": "Posted Content",
      "book-chapter": "Book Chapter",
      "proceedings-article": "Conference Paper",
      book: "Book",
      dataset: "Dataset",
      report: "Report",
      "journal-issue": "Journal Issue",
      "peer-review": "Peer Review",
      "reference-entry": "Reference Entry",
      component: "Component",
      monograph: "Monograph",
      dissertation: "Dissertation",
      standard: "Standard",
      grant: "Grant",
      "book-part": "Book Part",
      "book-section": "Book Section",
      "book-series": "Book Series",
      "book-set": "Book Set",
      "book-track": "Book Track",
      journal: "Journal",
      "journal-volume": "Journal Volume",
      proceedings: "Proceedings",
      "proceedings-series": "Proceedings Series",
      "report-series": "Report Series",
      "standard-series": "Standard Series",
    }
  }
}

// Function to fetch CrossRef sub-types
export async function fetchCrossRefSubTypes(): Promise<Record<string, string>> {
  if (subTypeCache) {
    return subTypeCache
  }

  // Default sub-type mapping
  const defaultSubTypes: Record<string, string> = {
    preprint: "Preprint",
    "working-paper": "Working Paper",
    letter: "Letter",
    "dissertation-thesis": "Dissertation/Thesis",
    report: "Report",
    "conference-paper": "Conference Paper",
    "conference-abstract": "Conference Abstract",
    "conference-poster": "Conference Poster",
    "conference-presentation": "Conference Presentation",
    "conference-proceedings": "Conference Proceedings",
    "data-management-plan": "Data Management Plan",
    "peer-review": "Peer Review",
  }

  // For now, we'll use a hardcoded mapping since CrossRef doesn't have a direct API for sub-types
  subTypeCache = defaultSubTypes
  return defaultSubTypes
}

// Function to get a human-readable label for a CrossRef type
export async function getTypeLabel(type: string, subType?: string): Promise<string> {
  // If we have a sub-type and it's for posted-content, use that instead
  if (subType && type === "posted-content") {
    const subTypes = await fetchCrossRefSubTypes()
    if (subTypes[subType]) {
      return subTypes[subType]
    }
  }

  // Otherwise use the main type
  const types = await fetchCrossRefTypes()
  return types[type] || type
}
