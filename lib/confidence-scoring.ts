import type { ConfidenceLevel } from "./types"

// Pure scoring logic used by the basic (non-LLM) matching path in
// lib/search-service.ts. Extracted into its own module - without a
// "use server" directive - so it can be unit tested directly without
// hitting the network and without the "use server" export restriction
// (a "use server" file can only export async functions).

const MIN_WORD_LENGTH = 3
const TITLE_WEIGHT = 0.7
const AUTHOR_WEIGHT = 0.3
const FIRST_AUTHOR_MATCH_WEIGHT = 0.6
const COMMON_AUTHOR_WEIGHT = 0.4

export const MIN_TITLE_SCORE_TO_CONSIDER = 0.5
export const HIGH_CONFIDENCE_THRESHOLD = 0.9
export const MEDIUM_CONFIDENCE_THRESHOLD = 0.7

// 1.0 for an exact (case-insensitive) title match, otherwise the fraction of
// words longer than MIN_WORD_LENGTH that the two titles have in common.
export function calculateTitleScore(sourceTitle: string, targetTitle: string): number {
  const source = sourceTitle.toLowerCase()
  const target = targetTitle.toLowerCase()

  if (!source || !target) return 0
  if (source === target) return 1.0

  const sourceWords = source.split(/\s+/).filter((w) => w.length > MIN_WORD_LENGTH)
  const targetWords = target.split(/\s+/).filter((w) => w.length > MIN_WORD_LENGTH)

  if (sourceWords.length === 0 || targetWords.length === 0) return 0

  const sourceWordSet = new Set(sourceWords)
  const commonWords = targetWords.filter((word) => sourceWordSet.has(word)).length

  return commonWords / Math.max(sourceWords.length, targetWords.length)
}

// Weights a first-author match heavily, plus a smaller contribution for
// overlap across the rest of the author list.
export function calculateAuthorScore(sourceAuthors: string[], targetAuthors: string[]): number {
  const source = sourceAuthors.map((author) => author.toLowerCase().trim()).filter(Boolean)
  const target = targetAuthors.map((author) => author.toLowerCase().trim()).filter(Boolean)

  if (source.length === 0 || target.length === 0) return 0

  const firstAuthorMatch = source[0] === target[0]
  const targetAuthorSet = new Set(target)
  const commonAuthors = source.filter((author) => targetAuthorSet.has(author)).length

  return (
    (firstAuthorMatch ? FIRST_AUTHOR_MATCH_WEIGHT : 0) +
    (COMMON_AUTHOR_WEIGHT * commonAuthors) / Math.max(source.length, target.length)
  )
}

export function calculateCombinedScore(titleScore: number, authorScore: number): number {
  return titleScore * TITLE_WEIGHT + authorScore * AUTHOR_WEIGHT
}

export function confidenceFromScore(combinedScore: number): ConfidenceLevel {
  if (combinedScore > HIGH_CONFIDENCE_THRESHOLD) return "High"
  if (combinedScore > MEDIUM_CONFIDENCE_THRESHOLD) return "Medium"
  return "Low"
}
