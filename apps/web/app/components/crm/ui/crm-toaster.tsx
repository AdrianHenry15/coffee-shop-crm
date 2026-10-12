"use client"

import { useEffect, useState } from "react"
import { Toaster } from "sonner"

export function CRMToaster() {
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    const root = document.documentElement

    const updateTheme = () => {
      setTheme(root.getAttribute("data-theme") === "dark" ? "dark" : "light")
    }

    updateTheme()

    const observer = new MutationObserver(updateTheme)

    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme"],
    })

    return () => observer.disconnect()
  }, [])

  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      duration={4000}
      theme={theme}
    />
  )
}
