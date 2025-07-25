/**
 * Formats abstract text by converting JATS XML tags to HTML
 * This is safe to use on the server side
 */
export function formatAbstract(abstract?: string): string {
  if (!abstract) return "No abstract available"

  // Check if the abstract contains JATS XML tags
  const containsJatsXml = abstract.includes("<jats:") || abstract.includes("</jats:")

  if (!containsJatsXml) {
    // If no JATS tags, just clean the text
    return abstract.replace(/<[^>]*>/g, "").trim()
  }

  // Convert JATS XML tags to HTML
  let formattedAbstract = abstract
    // Convert paragraph tags
    .replace(/<\/?jats:p[^>]*>/g, (match) => {
      return match.replace(/<\/?jats:p/g, "<p").replace(/jats:p>/g, "p>")
    })
    // Convert italic tags
    .replace(/<\/?jats:italic[^>]*>/g, (match) => {
      return match.replace(/<\/?jats:italic/g, "<em").replace(/jats:italic>/g, "em>")
    })
    // Convert bold tags
    .replace(/<\/?jats:bold[^>]*>/g, (match) => {
      return match.replace(/<\/?jats:bold/g, "<strong").replace(/jats:bold>/g, "strong>")
    })
    // Convert superscript
    .replace(/<\/?jats:sup[^>]*>/g, (match) => {
      return match.replace(/<\/?jats:sup/g, "<sup").replace(/jats:sup>/g, "sup>")
    })
    // Convert subscript
    .replace(/<\/?jats:sub[^>]*>/g, (match) => {
      return match.replace(/<\/?jats:sub/g, "<sub").replace(/jats:sub>/g, "sub>")
    })
    // Convert lists
    .replace(/<\/?jats:list[^>]*>/g, (match) => {
      return match.replace(/<\/?jats:list/g, "<ul").replace(/jats:list>/g, "ul>")
    })
    // Convert list items
    .replace(/<\/?jats:list-item[^>]*>/g, (match) => {
      return match.replace(/<\/?jats:list-item/g, "<li").replace(/jats:list-item>/g, "li>")
    })
    // Remove other JATS tags but keep their content
    .replace(/<\/?jats:[^>]*>/g, "")

  // Basic sanitization - remove any script tags
  formattedAbstract = formattedAbstract.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")

  return formattedAbstract
}
