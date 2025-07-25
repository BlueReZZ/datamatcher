export type ConfidenceLevel = "Very High" | "High" | "Medium" | "Low"
export type PublicationType = "preprint" | "article" | "unknown"

export interface Publication {
  title: string
  authors: string[]
  doi?: string
  publicationDate?: string
  type: PublicationType
  originalType?: string // Raw type from CrossRef
  subType?: string // Sub-type for more specific categorization
  publisher?: string // Publisher information
  institution?: string // Institution/preprint server for preprints
  containerTitle?: string // Journal title for articles
  abstract?: string // Abstract text
  typeLabel?: string // Human-readable label for the publication type
}

export interface ArticleMatch {
  source: Publication
  match?: Publication
  confidenceLevel: ConfidenceLevel
}

export interface CrossRefWork {
  DOI: string
  title: string[]
  author: Array<{
    given: string
    family: string
    sequence: string
    affiliation: Array<{
      name: string
    }>
  }>
  published: {
    "date-parts": number[][]
  }
  relation?: {
    "is-preprint-of"?: Array<{
      "id-type": string
      id: string
      "asserted-by": string
    }>
    "has-preprint"?: Array<{
      "id-type": string
      id: string
      "asserted-by": string
    }>
  }
  type: string
  publisher: string
  institution?: Array<{
    name: string
  }>
  "container-title"?: string[]
  abstract?: string
}

export interface CrossRefResponse {
  status: string
  "message-type": string
  "message-version": string
  message: {
    items: CrossRefWork[]
    "total-results": number
    "items-per-page": number
  }
}
