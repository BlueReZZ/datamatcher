import type React from "react"
import type { Metadata } from "next"
import { Poppins } from "next/font/google"
import "./globals.css"
import { Navbar } from "@/components/navbar"

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-poppins",
})

export const metadata: Metadata = {
  title: "Open Science Data Matcher",
  description: "Connect and discover relationships between research outputs across the scholarly ecosystem",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${poppins.className} ${poppins.variable}`}>
        <Navbar />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  )
}
