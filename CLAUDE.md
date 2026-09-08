# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Open Science Data Matcher — a Next.js app that matches preprints to their published journal versions and discovers related datasets, using live calls to CrossRef, DataDryad, and Figshare (no database; nothing is persisted between requests). It also renders a D3-based "research network" graph of a publication's relations.

This codebase originates from v0.app (see `generator: 'v0.app'` in `app/layout.tsx` and the `-rc` pinned Radix versions in `package.json`) and has since been patched for Next.js 16 / React 19 compatibility by hand (see recent commits fixing `searchParams` and `<a>` vs `Link`).

## Commands

Package manager is **pnpm** (`pnpm-lock.yaml` is present, use pnpm not npm/yarn).

```bash
pnpm install
pnpm exec next dev      # dev server
pnpm exec next build    # production build
pnpm exec next start    # run a production build
pnpm test               # run the vitest suite once
pnpm test:watch         # vitest in watch mode
```

There is no lint script. Tests live under `tests/` and run with Vitest (`vitest.config.mts`) — they call `lib/` functions directly (e.g. `searchArticles`) rather than mocking, so they hit the real CrossRef API and are genuinely network-dependent; see the "Testing" note below before adding more.

`next.config.mjs` sets `typescript: { ignoreBuildErrors: true }` and `images: { unoptimized: true }` — a production build will succeed even with type errors, so type-check manually with `pnpm exec tsc --noEmit` if you want that signal.

## Environment variables

- `OPENAI_API_KEY` — optional. Gates LLM-based fuzzy matching (`ai` + `@ai-sdk/openai`, model `gpt-4o-mini`) in `lib/search-service.ts`. Without it, matching silently falls back to the basic algorithm; the home page (`app/page.tsx`) renders a warning banner when it's unset.
- `CROSSREF_PLUS_TOKEN` — optional. Adds a `Crossref-Plus-API-Token` header to CrossRef requests for higher rate limits (`lib/search-service.ts`).

## Architecture

Everything under `lib/` that talks to an external API is a `"use server"` module — these are server actions, not a conventional service layer with DI; they're called both directly from Server Components (e.g. `app/compare/actions.ts`) and wrapped by thin route handlers in `app/api/*`.

### Matching pipeline (`lib/search-service.ts`)

`searchArticles(query)` / `searchArticlesAdvanced(params)` run a cascading strategy, each step only running if the previous one didn't produce good results, in order to stay under Vercel's function timeout:

1. **CrossRef search** — query the CrossRef `/works` endpoint.
2. **Direct matches** (`extractDirectMatches`) — trust CrossRef's own `relation["has-preprint"]` / `relation["is-preprint-of"]` metadata when present → confidence `"Very High"`.
3. **Basic matching** (`performBasicMatching`) — bidirectional title-word-overlap + author-surname-overlap scoring between preprints and journal-articles in the result set → confidence `"High"/"Medium"/"Low"`.
4. **LLM fuzzy matching** (`performFuzzyMatchingWithTimeout`) — last resort only, and only if there's enough time budget left (`TOTAL_FUNCTION_TIMEOUT_MS = 45000`, `LLM_TIMEOUT_MS = 15000`) and both preprints and articles exist in the result set. Sends a trimmed-down payload to `gpt-4o-mini` and parses a JSON array out of the response text.

Every step is wrapped so failures fall back to the next step rather than throwing — expect a lot of nested `try/catch` and `console.log`/`console.error` tracing throughout this file; that's the existing debugging convention, not incidental noise.

### Research network (`lib/network-service.ts`)

`buildResearchNetwork(anchorDoi, relatedDoi?, useMatchingAlgorithm?, useRepositoryData?, expandSecondLevel?)` builds a `{ nodes, links }` graph starting from an anchor DOI's CrossRef metadata relations, then optionally layers on:

- **Matching algorithm** (`enhanceNetworkWithMatching`) — reuses `searchArticles` from the search pipeline to find additional algorithmic matches (skipped automatically if metadata already gave a "Very High" confidence match).
- **Repository data** (`enhanceNetworkWithRepositoryData`) — dynamically imports `lib/repository-search.ts` to attach related datasets from DataDryad/Figshare to the anchor node.
- **Second-level expansion** (`expandSecondLevelConnections`) — follows relations one hop further out from non-anchor nodes.

Non-DOI relation targets get a placeholder node (`createPlaceholderNode`) that fetches the URI's `<title>` via `lib/uri-service.ts` (5s timeout) rather than being dropped.

### Route structure

- `app/api/search`, `app/api/publication`, `app/api/publication-raw`, `app/api/confirm-match` — thin `NextResponse.json` wrappers over the `lib/` functions.
- `app/compare` — server-rendered side-by-side comparison of a source/match DOI pair (`app/compare/actions.ts` fetches directly from CrossRef rather than going through `lib/search-service.ts`), with a client `ConfirmMatchForm` that posts to `app/api/confirm-match`.
- `app/research-network` — reads `searchParams`, calls `buildResearchNetwork`, renders `components/research-network-visualization.tsx` (D3).
- `components/ui/*` — shadcn/ui primitives (`components.json`: style `new-york`, base color `neutral`, no `tailwind.config` path since Tailwind v4 is CSS-config-only via `@tailwindcss/postcss`).

### Next.js 16 note

`searchParams` on page components must be typed as a `Promise` and awaited (see `app/research-network/page.tsx` and `app/compare/page.tsx`) — this was a real regression first fixed in commit `7e24621`; a second instance in `app/compare/page.tsx` was missed and fixed later. If you add a new page that reads `searchParams`, use the same `Promise<...>` + `await` pattern.

Publication data normalization (`convertToPub`/`safeConvertToPub`/`sanitizePublication` converting a CrossRef `work` object into the app's `Publication` type) is duplicated near-verbatim across `lib/search-service.ts`, `app/api/publication/route.ts`, and `app/compare/actions.ts` rather than shared — be aware when fixing a CrossRef-parsing bug that it likely needs the same fix in more than one place.

## Testing

There's no mocking layer for CrossRef/DataDryad/Figshare, so tests under `tests/` call `lib/` functions directly and hit the real APIs — they assert on *outcomes* (e.g. "this query produces a Very High confidence match") rather than exact response shapes, since upstream data can shift over time.

Two things every test in this style needs, both demonstrated in `tests/homepage-example-searches.test.ts`:

- **Retry on any failure, not just 429** — CrossRef's public tier allows ~1 request/second and a single `searchArticles()` call can itself fire several requests (initial search + per-match DOI lookups via `fetchPublicationByDOI`), so treat rate limits *and* transient connect timeouts as retryable, with backoff and spacing between test cases.
- **A `beforeAll` network warm-up with its own timeout** — the first outbound connection in a fresh test run is occasionally slow to establish; without a warm-up, that latency eats into the first real test's retry budget instead of its own.

The example-search list in that test file is sourced from `EXAMPLE_SEARCHES` in `components/search-form.tsx` (the "Try an example" links on the homepage) — if that list changes, check whether the test's confidence-level expectations still hold.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
