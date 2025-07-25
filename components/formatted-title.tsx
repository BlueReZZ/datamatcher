"use client"

import { formatTitle, titleContainsHtml, sanitizeTitleHtml } from "@/lib/format-title"

interface FormattedTitleProps {
  title: string
  className?: string
  maxLength?: number
}

export function FormattedTitle({ title, className = "", maxLength }: FormattedTitleProps) {
  // Truncate if needed
  let displayTitle = title
  if (maxLength && title.length > maxLength) {
    displayTitle = title.substring(0, maxLength) + "..."
  }

  // Check if the title contains HTML
  if (titleContainsHtml(displayTitle)) {
    const sanitizedHtml = sanitizeTitleHtml(displayTitle)

    return (
      <span
        className={className}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        title={formatTitle(title)} // Show full title on hover
      />
    )
  }

  // No HTML, render as plain text
  const formattedTitle = formatTitle(displayTitle)

  return (
    <span className={className} title={title}>
      {formattedTitle}
    </span>
  )
}
