"use server"

import { redirect } from "next/navigation"

export async function confirmMatch(formData: FormData) {
  try {
    const sourceDoi = formData.get("sourceDoi")
    const matchDoi = formData.get("matchDoi")

    if (!sourceDoi || !matchDoi) {
      throw new Error("Missing DOI parameters")
    }

    // Here you would typically save the confirmed match to a database
    console.log(`Match confirmed via server action: ${sourceDoi} -> ${matchDoi}`)

    // Redirect to the research network visualization page with enhanced mode enabled
    redirect(
      `/research-network?anchor=${encodeURIComponent(sourceDoi.toString())}&related=${encodeURIComponent(matchDoi.toString())}&useMatching=true`,
    )
  } catch (error) {
    console.error("Error in confirm match server action:", error)
    // Since we can't return an error from a server action that uses redirect,
    // we'll redirect to an error page or back to the compare page
    redirect(`/compare?error=true`)
  }
}
