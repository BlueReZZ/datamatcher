/**
 * Formats a CrossRef relation type into a human-readable label
 * @param relationType The relation type from CrossRef API (e.g., "is-preprint-of")
 * @returns Formatted relation type (e.g., "Is Preprint Of")
 */
export function formatRelationType(relationType: string): string {
  // Handle special cases
  if (relationType === "confirmed-match") {
    return "Confirmed Match"
  }

  // Split by hyphens and capitalize each word
  return relationType
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
