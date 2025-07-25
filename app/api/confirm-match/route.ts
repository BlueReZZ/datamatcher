import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    // Parse the form data
    const formData = await request.formData()
    const sourceDoi = formData.get("sourceDoi")
    const matchDoi = formData.get("matchDoi")

    console.log("Received form data:", { sourceDoi, matchDoi })

    if (!sourceDoi || !matchDoi) {
      console.error("Missing DOI parameters in form data")
      return NextResponse.json({ error: "Missing DOI parameters" }, { status: 400 })
    }

    // Here you would typically save the confirmed match to a database
    console.log(`Match confirmed: ${sourceDoi} -> ${matchDoi}`)

    // Return a success response with enhanced mode enabled by default
    return NextResponse.json({
      success: true,
      message: "Match confirmed successfully",
      redirectUrl: `/research-network?anchor=${encodeURIComponent(sourceDoi.toString())}&related=${encodeURIComponent(matchDoi.toString())}&useMatching=true`,
    })
  } catch (error) {
    // Log the detailed error
    console.error("Error in confirm-match API route:", error)

    // Return a more detailed error response
    return NextResponse.json(
      {
        error: "Failed to confirm match",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// Add a GET handler to handle direct access to this route
export async function GET(request: NextRequest) {
  // Redirect to the information page when accessed directly
  const baseUrl = new URL(request.url).origin
  return NextResponse.redirect(`${baseUrl}/confirm-match`, 303)
}
