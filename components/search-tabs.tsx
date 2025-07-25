"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SearchForm } from "@/components/search-form"
import { AdvancedSearchForm } from "@/components/advanced-search-form"
import { OrcidSearchForm } from "@/components/orcid-search-form"

export function SearchTabs() {
  // Check if we're returning from the comparison page to determine which tab to show
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const lastTab = sessionStorage.getItem("lastActiveSearchTab")
      return lastTab || "basic"
    }
    return "basic"
  })

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    sessionStorage.setItem("lastActiveSearchTab", value)
  }

  return (
    <Tabs defaultValue={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-4">
        <TabsTrigger value="basic">Basic Search</TabsTrigger>
        <TabsTrigger value="advanced">Advanced Search</TabsTrigger>
        <TabsTrigger value="orcid">My Content Search</TabsTrigger>
      </TabsList>
      <TabsContent value="basic">
        <SearchForm />
      </TabsContent>
      <TabsContent value="advanced">
        <AdvancedSearchForm />
      </TabsContent>
      <TabsContent value="orcid">
        <OrcidSearchForm />
      </TabsContent>
    </Tabs>
  )
}
