import { describe, expect, it } from "vitest"
import {
  HIGH_CONFIDENCE_THRESHOLD,
  MEDIUM_CONFIDENCE_THRESHOLD,
  MIN_TITLE_SCORE_TO_CONSIDER,
  calculateAuthorScore,
  calculateCombinedScore,
  calculateTitleScore,
  confidenceFromScore,
} from "./confidence-scoring"

describe("calculateTitleScore", () => {
  it("scores an exact match (case-insensitive) as 1.0", () => {
    expect(calculateTitleScore("Some Paper Title", "some paper title")).toBe(1.0)
  })

  it("scores completely unrelated titles as 0", () => {
    expect(calculateTitleScore("Gene editing in zebrafish embryos", "Coastal erosion patterns in Norway")).toBe(0)
  })

  it("scores partial word overlap between 0 and 1", () => {
    const score = calculateTitleScore(
      "CRISPR-Cas9 gene editing in human stem cells",
      "CRISPR-Cas9 gene editing in mouse embryos",
    )
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(1)
  })

  it("ignores words of length 3 or shorter when comparing", () => {
    // Every word here is <= 3 characters, so there are no comparable words at all
    // and the score falls back to 0 rather than a divide-by-zero/NaN.
    expect(calculateTitleScore("The Sun and Sky", "A Big Red Sun")).toBe(0)
  })

  it("returns 0 when either title is empty", () => {
    expect(calculateTitleScore("", "Some paper title")).toBe(0)
    expect(calculateTitleScore("Some paper title", "")).toBe(0)
  })
})

describe("calculateAuthorScore", () => {
  it("weights a first-author match heavily even with no other overlap", () => {
    const score = calculateAuthorScore(["smith", "jones"], ["smith", "lee"])
    expect(score).toBeGreaterThan(0.6)
    expect(score).toBeLessThan(1)
  })

  it("scores identical author lists as 1.0", () => {
    expect(calculateAuthorScore(["smith", "jones"], ["smith", "jones"])).toBe(1.0)
  })

  it("scores completely disjoint author lists as 0", () => {
    expect(calculateAuthorScore(["smith", "jones"], ["lee", "chen"])).toBe(0)
  })

  it("scores overlap without a first-author match lower than a first-author match", () => {
    const withoutFirstAuthorMatch = calculateAuthorScore(["jones", "smith"], ["smith", "lee"])
    const withFirstAuthorMatch = calculateAuthorScore(["smith", "jones"], ["smith", "lee"])
    expect(withoutFirstAuthorMatch).toBeLessThan(withFirstAuthorMatch)
  })

  it("returns 0 when either author list is empty", () => {
    expect(calculateAuthorScore([], ["smith"])).toBe(0)
    expect(calculateAuthorScore(["smith"], [])).toBe(0)
  })

  it("is case-insensitive and trims whitespace", () => {
    expect(calculateAuthorScore(["  Smith  "], ["smith"])).toBe(1.0)
  })
})

describe("calculateCombinedScore", () => {
  it("weights title at 0.7 and authors at 0.3", () => {
    expect(calculateCombinedScore(1, 0)).toBeCloseTo(0.7)
    expect(calculateCombinedScore(0, 1)).toBeCloseTo(0.3)
    expect(calculateCombinedScore(1, 1)).toBeCloseTo(1)
    expect(calculateCombinedScore(0, 0)).toBe(0)
  })
})

describe("confidenceFromScore", () => {
  it(`returns "High" above the high-confidence threshold (${HIGH_CONFIDENCE_THRESHOLD})`, () => {
    expect(confidenceFromScore(HIGH_CONFIDENCE_THRESHOLD + 0.01)).toBe("High")
    expect(confidenceFromScore(1)).toBe("High")
  })

  it(`returns "Medium" above the medium threshold (${MEDIUM_CONFIDENCE_THRESHOLD}) but at/below the high threshold`, () => {
    expect(confidenceFromScore(MEDIUM_CONFIDENCE_THRESHOLD + 0.01)).toBe("Medium")
    expect(confidenceFromScore(HIGH_CONFIDENCE_THRESHOLD)).toBe("Medium")
  })

  it(`returns "Low" at or below the medium threshold (${MEDIUM_CONFIDENCE_THRESHOLD})`, () => {
    expect(confidenceFromScore(MEDIUM_CONFIDENCE_THRESHOLD)).toBe("Low")
    expect(confidenceFromScore(0)).toBe("Low")
  })
})

describe("end-to-end scoring scenarios (title + author -> confidence)", () => {
  // These mirror the shape of a real preprint/article pair as performBasicMatching
  // sees it, to guard the thresholds against a real-world regression, not just the
  // individual scoring functions in isolation.
  function scoreMatch(sourceTitle: string, sourceAuthors: string[], targetTitle: string, targetAuthors: string[]) {
    const titleScore = calculateTitleScore(sourceTitle, targetTitle)
    const authorScore = calculateAuthorScore(sourceAuthors, targetAuthors)
    return confidenceFromScore(calculateCombinedScore(titleScore, authorScore))
  }

  it("an identical title and author list is High confidence", () => {
    expect(
      scoreMatch(
        "Synthetic eco-evolutionary dynamics in simple molecular environment",
        ["casiraghi", "bellini"],
        "Synthetic eco-evolutionary dynamics in simple molecular environment",
        ["casiraghi", "bellini"],
      ),
    ).toBe("High")
  })

  it("a near-identical title with a different first author is Medium confidence", () => {
    expect(
      scoreMatch(
        "Zinc finger homeobox-3 orchestrates genome-wide daily gene expression",
        ["chen", "smith"],
        "Zinc finger homeobox-3 orchestrates genome-wide daily gene expression",
        ["lopez", "smith"],
      ),
    ).toBe("Medium")
  })

  it("a title below the minimum similarity threshold would not even be considered a candidate", () => {
    const titleScore = calculateTitleScore(
      "Synthetic eco-evolutionary dynamics in simple molecular environment",
      "Coastal erosion patterns along the Norwegian fjords",
    )
    expect(titleScore).toBeLessThan(MIN_TITLE_SCORE_TO_CONSIDER)
  })
})
