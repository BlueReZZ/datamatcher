"use server"

export interface UriMetadata {
  title: string | null
  statusCode: number
  error?: string
}

export async function fetchUriMetadata(uri: string): Promise<UriMetadata> {
  try {
    console.log(`Fetching URI metadata for: ${uri}`)

    // Set a reasonable timeout to avoid hanging on slow resources
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    const response = await fetch(uri, {
      signal: controller.signal,
      headers: {
        // Some sites block requests without a user agent
        "User-Agent": "PrePrintDOIMatcher/1.0 (Research Network Visualization Tool)",
      },
    })

    clearTimeout(timeoutId)

    // Get the status code
    const statusCode = response.status

    // Only try to extract title if it's HTML content
    const contentType = response.headers.get("content-type") || ""
    if (contentType.includes("text/html")) {
      const html = await response.text()

      // Extract title using regex that handles multiline content
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
      const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, " ") : null

      console.log(`Extracted title from URI: "${title}"`)

      return {
        title,
        statusCode,
      }
    }

    // For non-HTML content, return just the status code
    return {
      title: null,
      statusCode,
    }
  } catch (error) {
    console.error(`Error fetching URI metadata for ${uri}:`, error)

    // Handle different error types
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return {
          title: null,
          statusCode: 0, // Use 0 to indicate timeout
          error: "Request timed out",
        }
      }

      return {
        title: null,
        statusCode: -1, // Use -1 to indicate error
        error: error.message,
      }
    }

    return {
      title: null,
      statusCode: -1,
      error: "Unknown error",
    }
  }
}
