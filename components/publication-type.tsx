import type { Publication, PublicationType } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { FileTextIcon, NewspaperIcon, HelpCircleIcon } from "lucide-react"

// Shared between the search results cards and the compare page so a
// publication's type always reads the same icon/color/label in both places.
export function PublicationTypeIcon({ type, className }: { type: PublicationType; className?: string }) {
  if (type === "preprint") {
    return <FileTextIcon className={className ?? "h-5 w-5 text-teal-600"} />
  }
  if (type === "article") {
    return <NewspaperIcon className={className ?? "h-5 w-5 text-violet-600"} />
  }
  return <HelpCircleIcon className={className ?? "h-5 w-5 text-muted-foreground"} />
}

export function PublicationTypeBadge({ publication }: { publication: Publication }) {
  if (publication.type === "preprint") {
    return (
      <Badge className="bg-teal-600 text-white hover:bg-teal-700 uppercase tracking-wide text-xs font-bold">
        Preprint
      </Badge>
    )
  }
  if (publication.type === "article") {
    return (
      <Badge className="bg-violet-600 text-white hover:bg-violet-700 uppercase tracking-wide text-xs font-bold">
        Published Article
      </Badge>
    )
  }
  if (publication.typeLabel) {
    return (
      <Badge className="bg-orange-600 text-white hover:bg-orange-700 uppercase tracking-wide text-xs font-bold">
        {publication.typeLabel}
      </Badge>
    )
  }
  return (
    <Badge className="bg-orange-600 text-white hover:bg-orange-700 uppercase tracking-wide text-xs font-bold">
      Unknown
    </Badge>
  )
}
