"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CodeIcon } from "lucide-react"

interface JsonViewerProps {
  data: any
  title: string
}

export function JsonViewer({ data, title }: JsonViewerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => setIsOpen(true)}>
          <CodeIcon className="h-4 w-4" />
          <span>View JSON</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="bg-slate-950 text-slate-50 p-4 rounded-md overflow-auto max-h-[60vh]">
          <pre className="text-sm font-mono whitespace-pre-wrap break-all">{JSON.stringify(data, null, 2)}</pre>
        </div>
      </DialogContent>
    </Dialog>
  )
}
