/**
 * Formats title text by converting HTML entities and handling basic HTML formatting
 */
export function formatTitle(title?: string): string {
  if (!title) return "Unknown Title"

  // First, decode HTML entities
  let formattedTitle = title
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")

  // Add spaces around HTML tags if they're missing
  // This handles cases like "genus<i>Cortinarius</i>should" -> "genus <i>Cortinarius</i> should"
  formattedTitle = formattedTitle
    // Add space before opening tag if there's a letter/number directly before it
    .replace(/([a-zA-Z0-9])(<[^>]+>)/g, "$1 $2")
    // Add space after closing tag if there's a letter/number directly after it
    .replace(/(<\/[^>]+>)([a-zA-Z0-9])/g, "$1 $2")

  return formattedTitle
}

/**
 * Formats title text for plain text display by removing HTML tags but preserving spacing
 */
export function formatTitlePlainText(title?: string): string {
  if (!title) return "Unknown Title"

  // First format the title to get proper spacing
  const formatted = formatTitle(title)

  // Remove all HTML tags but keep the content and spacing
  const plainText = formatted.replace(/<[^>]*>/g, "")

  // Clean up any double spaces that might have been created and trim
  return plainText.replace(/\s+/g, " ").trim()
}

/**
 * Checks if a title contains HTML tags
 */
export function titleContainsHtml(title?: string): boolean {
  if (!title) return false
  return /<[^>]+>/.test(title)
}

/**
 * Sanitizes HTML in titles to only allow safe formatting tags
 */
export function sanitizeTitleHtml(title?: string): string {
  if (!title) return "Unknown Title"

  // First format the title to decode entities and add proper spacing
  const formatted = formatTitle(title)

  // Only allow safe formatting tags
  const allowedTags = ["i", "em", "b", "strong", "sup", "sub"]

  // Remove any tags that aren't in our allowed list
  const sanitized = formatted.replace(/<\/?([^>]+)>/g, (match, tagContent) => {
    const tagName = tagContent.split(" ")[0].toLowerCase()
    if (allowedTags.includes(tagName)) {
      return match
    }
    return "" // Remove disallowed tags
  })

  // Clean up any double spaces that might have been created
  return sanitized.replace(/\s+/g, " ").trim()
}
