import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { searchArticles } from "@/lib/search-service"
import type { ArticleMatch, ConfidenceLevel } from "@/lib/types"

// These are the exact "Try an example" links on the homepage
// (components/search-form.tsx, EXAMPLE_SEARCHES) - each one is a curated
// demo of a specific matching outcome, not an arbitrary search term.

const VERY_HIGH_CONFIDENCE_EXAMPLES = [
  "Synthetic eco-evolutionary dynamics in simple molecular environment",
  "A weakly structured stem for human origins in Africa",
  "Oncogenic RAS Induces a Distinctive Form of Non-Canonical Autophagy Mediated by the P38-ULK1-PI4KB Axis",
  "Zinc finger homeobox-3 (ZFHX3) orchestrates genome-wide daily gene expression in the suprachiasmatic nucleus",
  "High resolution deep mutational scanning of the melanocortin-4 receptor enables target characterization for drug discovery",
]

const MEDIUM_CONFIDENCE_EXAMPLES = [
  "The genus Cortinarius should not (yet) be split",
  "Social state alters vision using three circuit mechanisms in Drosophila",
]

// CrossRef's public API allows ~1 request/second, and a single searchArticles()
// call can itself fire several requests (initial search + per-match DOI lookups),
// so back off between cases and retry on 429 rather than treating rate-limiting
// as a real failure.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Any failure here means CrossRef never responded (rate limit, DNS hiccup, connect
// timeout) rather than the app producing a wrong result, so retry regardless of cause.
async function searchWithRetry(query: string, retries = 3): Promise<ArticleMatch[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await searchArticles(query)
    } catch (error) {
      if (attempt === retries) throw error
      await sleep(2000 * (attempt + 1))
    }
  }
  throw new Error("unreachable")
}

function expectSomeMatchAtConfidence(results: ArticleMatch[], confidenceLevel: ConfidenceLevel) {
  expect(results.length).toBeGreaterThan(0)
  const found = results.some((result) => result.confidenceLevel === confidenceLevel && result.match)
  expect(found).toBe(true)
}

afterEach(async () => {
  await sleep(1500)
})

// The very first outbound connection in this environment is occasionally slow to
// establish (cold DNS/TLS); warm it up outside of any individual test's timeout
// budget so a slow first connection doesn't eat into a real test's retry window.
beforeAll(async () => {
  try {
    await fetch("https://api.crossref.org/works?rows=0")
  } catch {
    // ignored - this is just a warm-up, the real requests below still retry
  }
}, 30000)

describe("homepage example searches", () => {
  describe.each(VERY_HIGH_CONFIDENCE_EXAMPLES)("%s", (query) => {
    it(
      "produces a Very High confidence match",
      async () => {
        const results = await searchWithRetry(query)
        expectSomeMatchAtConfidence(results, "Very High")
      },
      60000,
    )
  })

  describe.each(MEDIUM_CONFIDENCE_EXAMPLES)("%s", (query) => {
    it(
      "produces a Medium confidence match",
      async () => {
        const results = await searchWithRetry(query)
        expectSomeMatchAtConfidence(results, "Medium")
      },
      60000,
    )
  })
})
