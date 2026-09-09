# Matching algorithm

How `searchArticles` (`lib/search-service.ts`) matches preprints to their published journal versions: the cascade, the basic-matching scoring, the fuzzy-matching fallback, and the confidence thresholds.

## The cascade (`searchArticles`, `lib/search-service.ts:255`)

Each step only runs if the previous one failed to produce good-enough results — this keeps the function under Vercel's 45s budget (`TOTAL_FUNCTION_TIMEOUT_MS`):

1. **CrossRef search** (`searchCrossRef`) — queries `/works` with the raw query string, up to 20 rows. If CrossRef returns exactly 1 result, it retries with `searchCrossRefBroader`, which strips the query down to the first two meaningful words plus a guessed author name (a capitalized word), asking for up to 50 rows — trying to surface more candidates to match against.

2. **Direct matches** (`extractDirectMatches`, line 908) — looks at each result's own CrossRef relation metadata (`relation["has-preprint"]` / `relation["is-preprint-of"]`). If CrossRef itself already says "this journal article's preprint is DOI X," that's trusted outright as **"Very High"** confidence — no scoring involved. If the related DOI isn't in the result set, it fetches it directly via `fetchPublicationByDOI`. If *any* direct matches are found, they're returned immediately and nothing further runs.

3. **Basic matching** (`performBasicMatching`, line 1039) — only runs if step 2 found nothing. This is the word-overlap scoring described below. Its results get returned as final if there's at least one "High" or "Medium" confidence match.

4. **LLM fuzzy matching** (`performFuzzyMatchingWithTimeout`, line 1141) — last resort, and only attempted if:
   - basic matching's best results were all "Low" confidence,
   - there's enough time left (`timeRemaining >= LLM_TIMEOUT_MS + 5000`, i.e. ≥20s of the 45s budget),
   - and the result set actually contains both a preprint (`posted-content`) and a journal-article.

   If any of those conditions fail, or the LLM call itself errors/times out/returns unparseable JSON, it falls straight back to `performBasicMatching`.

## Basic matching scoring (`lib/confidence-scoring.ts`)

This runs bidirectionally: preprints→articles and articles→preprints (`findMatches` called twice at line 1119-1120), since a preprint might title-match one thing but a different article might be its best match in the other direction. For every source work, it scans all target works and keeps the single best-scoring candidate.

- **Title score** (`calculateTitleScore`) — 1.0 for an exact case-insensitive match; otherwise, words >3 chars are extracted from both titles, and the score is `(words in common) / max(sourceWordCount, targetWordCount)`. Pure word-overlap, no stemming/fuzzy string matching.
- Candidates below `MIN_TITLE_SCORE_TO_CONSIDER = 0.5` title score are skipped entirely before author scoring even happens (line 1078).
- **Author score** (`calculateAuthorScore`) — compares author surnames only. First-author-matches contributes a flat `0.6` (`FIRST_AUTHOR_MATCH_WEIGHT`); overlap across the rest of the list contributes up to `0.4` (`COMMON_AUTHOR_WEIGHT`) scaled by `commonAuthors / max(sourceCount, targetCount)`.
- **Combined score** (`calculateCombinedScore`) — `titleScore * 0.7 + authorScore * 0.3`. Title dominates.
- **Confidence thresholds** (`confidenceFromScore`):
  - `> 0.9` → **High**
  - `> 0.7` → **Medium**
  - otherwise → **Low**

Note these are strict `>`, so a combined score of exactly 0.9 or 0.7 falls into the lower bucket.

If no target clears the 0.5 title-score bar at all, the source is emitted alone with confidence **"Low"** and no `match`.

## LLM fuzzy matching

Only invoked when basic matching's title/author heuristics failed. It caps input to 5 preprints + 5 articles (`maxWorksPerType`), strips each down to title/first-3-authors/DOI/year to save tokens, and sends a terse prompt to `gpt-4o-mini` asking for a JSON array of `{preprint, article, confidenceLevel}` — explicitly told to only include High/Medium matches. The response is parsed by finding the substring between the first `[` and last `]` (no structured-output mode), matched back to the original works by DOI, and converted to `ArticleMatch`. Confidence level here is whatever the LLM itself claims, not computed — there's no scoring formula on this path. Any failure (missing API key, timeout, non-JSON response, empty array boundaries) falls back to `performBasicMatching`.
