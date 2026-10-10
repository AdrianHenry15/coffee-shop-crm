import type { Metadata } from "next"
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google"
import "./globals.css"

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "CoffeeShopCRM",
    template: "%s | CoffeeShopCRM",
  },
  description:
    "Manage customers, leads, estimates, jobs, and business operations with CoffeeShopCRM.",
}

const themeScript = `
  (() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")

    function applyTheme() {
      const saved = localStorage.getItem("coffeeshop-theme")

      document.documentElement.dataset.theme =
        saved === "light" || saved === "dark"
          ? saved
          : media.matches ? "dark" : "light"
    }

    try {
      applyTheme()
      media.addEventListener("change", applyTheme)
      window.addEventListener("storage", applyTheme)
    } catch {
      document.documentElement.dataset.theme = "light"
    }
  })()
`

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>

      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
