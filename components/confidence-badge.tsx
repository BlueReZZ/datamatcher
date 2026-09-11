import { CheckCircle2Icon, ShieldCheckIcon, AlertCircleIcon, AlertTriangleIcon, HelpCircleIcon, type LucideIcon } from "lucide-react"

export interface ConfidenceStripInfo {
  label: string
  classes: string
  icon: LucideIcon
}

// Shared between the search results cards and the compare page so a given
// confidence level always reads the same color/label/icon in both places.
export function getConfidenceStripInfo(confidence: string): ConfidenceStripInfo {
  switch (confidence) {
    case "Very High":
      return { label: "Very High Confidence", classes: "bg-success text-success-foreground", icon: CheckCircle2Icon }
    case "High":
      return { label: "High Confidence", classes: "bg-info text-info-foreground", icon: ShieldCheckIcon }
    case "Medium":
      return { label: "Medium Confidence", classes: "bg-warning text-warning-foreground", icon: AlertCircleIcon }
    case "Low":
      return { label: "Low Confidence", classes: "bg-destructive text-destructive-foreground", icon: AlertTriangleIcon }
    default:
      return { label: "Unknown Confidence", classes: "bg-muted text-muted-foreground", icon: HelpCircleIcon }
  }
}
