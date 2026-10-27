export type CatalogSection =
  | {
      id: string
      title: string
      kind: "text"
      content: { text: string }
    }
  | {
      id: string
      title: string
      kind: "list"
      content: { items: string[] }
    }
  | {
      id: string
      title: string
      kind: "specifications"
      content: { field_keys: string[] }
    }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  )
}

export function parseCatalogSections(value: unknown): CatalogSection[] {
  if (!Array.isArray(value) || value.length > 30) {
    throw new Error("Use up to 30 content sections.")
  }

  const ids = new Set<string>()

  return value.map((section, index): CatalogSection => {
    const label = `Section ${index + 1}`

    if (
      !isObject(section) ||
      typeof section.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        section.id,
      ) ||
      ids.has(section.id.toLowerCase())
    ) {
      throw new Error(`${label}: invalid or duplicate identifier.`)
    }

    ids.add(section.id.toLowerCase())

    if (
      typeof section.title !== "string" ||
      !section.title.trim() ||
      section.title.trim().length > 100
    ) {
      throw new Error(`${label}: enter a title up to 100 characters.`)
    }

    if (!isObject(section.content)) {
      throw new Error(`${label}: invalid content.`)
    }

    const base = {
      id: section.id,
      title: section.title.trim(),
    }

    if (section.kind === "text") {
      const text = section.content.text

      if (typeof text !== "string" || !text.trim() || text.length > 20000) {
        throw new Error(
          `${label}: enter a description up to 20,000 characters.`,
        )
      }

      return {
        ...base,
        kind: "text",
        content: { text },
      }
    }

    if (section.kind === "list") {
      const items = section.content.items

      if (
        !isStringArray(items) ||
        items.length === 0 ||
        items.length > 100 ||
        items.some((item) => !item.trim() || item.length > 1000)
      ) {
        throw new Error(
          `${label}: enter 1–100 list items, each up to 1,000 characters.`,
        )
      }

      return {
        ...base,
        kind: "list",
        content: { items },
      }
    }

    if (section.kind === "specifications") {
      const keys = section.content.field_keys

      if (
        !isStringArray(keys) ||
        keys.length === 0 ||
        keys.length > 50 ||
        new Set(keys).size !== keys.length ||
        keys.some((key) => !/^[a-z][a-z0-9_]{0,63}$/.test(key))
      ) {
        throw new Error(`${label}: choose 1–50 unique specification fields.`)
      }

      return {
        ...base,
        kind: "specifications",
        content: { field_keys: keys },
      }
    }

    throw new Error(`${label}: unsupported section type.`)
  })
}
