"use client"

import { useEffect, useState } from "react"
import { Skull, Sword, Monitor } from "lucide-react"

type Theme = "light" | "dark" | "system"

const STORAGE_KEY = "coffeeshop-theme"

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>("system")
  const [mounted, setMounted] = useState(false)

  // Load the saved preference after mounting.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)

    Promise.resolve().then(() => {
      setTheme(
        saved === "light" || saved === "dark" || saved === "system"
          ? saved
          : "system",
      )
      setMounted(true)
    })
  }, [])

  // Apply the selected theme.
  useEffect(() => {
    if (!mounted) return

    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)

    document.documentElement.dataset.theme = isDark ? "dark" : "light"
  }, [theme, mounted])

  function changeTheme(value: Theme) {
    setTheme(value)
    localStorage.setItem(STORAGE_KEY, value)
  }

  if (!mounted) return null

  return (
    <div className="space-y-3">
      <p className="font-mono text-xs font-medium uppercase tracking-wider text-sidebar-muted">
        Appearance
      </p>

      <div
        role="group"
        aria-label="Appearance"
        className="grid grid-cols-3 gap-2">
        {[
          { value: "light", label: "Light", Icon: Sword },
          { value: "dark", label: "Dark", Icon: Skull },
          { value: "system", label: "System", Icon: Monitor },
        ].map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            aria-label={`${label} theme`}
            aria-pressed={theme === value}
            title={`${label} theme`}
            onClick={() => changeTheme(value as Theme)}
            className={`flex items-center justify-center rounded-lg border p-3 transition-colors ${
              theme === value
                ? "border-[#86cfa8] bg-[#86cfa8] text-[#12372a]"
                : "border-white/20 bg-white/10 text-sidebar-foreground hover:bg-white/20"
            }`}>
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  )
}
