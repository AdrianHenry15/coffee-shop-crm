"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import type { CatalogField } from "@/app/lib/catalog/types"
import {
  parseCatalogSections,
  type CatalogSection,
} from "@/app/lib/catalog/sections"

type EditableSection = {
  id: string
  title: string
  kind: CatalogSection["kind"]
  body: string
  fieldKeys: string[]
}

type Props = {
  initialSections: CatalogSection[]
  fields: CatalogField[]
  onSave: (sections: string) => Promise<{ error?: string }>
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"

const buttonClass =
  "rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-50"

export function CatalogSectionEditor({
  initialSections,
  fields,
  onSave,
}: Props) {
  const router = useRouter()

  const [sections, setSections] = useState<EditableSection[]>(() =>
    initialSections.map((section) => ({
      id: section.id,
      title: section.title,
      kind: section.kind,
      body:
        section.kind === "text"
          ? section.content.text
          : section.kind === "list"
            ? section.content.items.join("\n")
            : "",
      fieldKeys:
        section.kind === "specifications" ? section.content.field_keys : [],
    })),
  )

  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function addSection(kind: CatalogSection["kind"]) {
    if (sections.length >= 30) return

    setMessage(null)

    setSections((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        kind,
        title:
          kind === "text"
            ? "Description"
            : kind === "list"
              ? "Features"
              : "Specifications",
        body: "",
        fieldKeys: [],
      },
    ])
  }

  function updateSection(id: string, changes: Partial<EditableSection>) {
    setMessage(null)

    setSections((previous) =>
      previous.map((section) =>
        section.id === id ? { ...section, ...changes } : section,
      ),
    )
  }

  function moveSection(index: number, direction: -1 | 1) {
    setMessage(null)

    setSections((previous) => {
      const destination = index + direction

      if (destination < 0 || destination >= previous.length) {
        return previous
      }

      const next = [...previous]
      ;[next[index], next[destination]] = [next[destination], next[index]]

      return next
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (pending) return

    setError(null)
    setMessage(null)

    let validated: CatalogSection[]

    try {
      validated = parseCatalogSections(
        sections.map((section) => ({
          id: section.id,
          title: section.title,
          kind: section.kind,
          content:
            section.kind === "text"
              ? { text: section.body.trim() }
              : section.kind === "list"
                ? {
                    items: section.body
                      .split(/\r?\n/)
                      .map((line) => line.trim())
                      .filter(Boolean),
                  }
                : { field_keys: section.fieldKeys },
        })),
      )
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : "Check the section content.",
      )
      return
    }

    startTransition(async () => {
      try {
        const result = await onSave(JSON.stringify(validated))

        if (result.error) {
          setError(result.error)
          return
        }

        setMessage("Content sections saved.")
        router.refresh()
      } catch {
        setError("Unable to save content. Please try again.")
      }
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-xl border border-border bg-surface p-6">
      <header className="space-y-2">
        <h2 className="font-mono text-lg font-semibold text-foreground">
          Content sections
        </h2>

        <p className="text-sm text-muted">
          Add descriptions, feature lists, and specification groups. Sections
          save separately from product details.
        </p>

        <p className="text-xs text-muted">
          Reordering and removal take effect when you save content sections.
        </p>
      </header>

      <fieldset disabled={pending} className="space-y-5">
        <legend className="sr-only">Edit content sections</legend>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={sections.length >= 30}
            onClick={() => addSection("text")}
            className={buttonClass}>
            Add description
          </button>

          <button
            type="button"
            disabled={sections.length >= 30}
            onClick={() => addSection("list")}
            className={buttonClass}>
            Add feature list
          </button>

          <button
            type="button"
            disabled={sections.length >= 30 || fields.length === 0}
            onClick={() => addSection("specifications")}
            className={buttonClass}>
            Add specifications
          </button>
        </div>

        {sections.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted">
            No content sections yet.
          </p>
        )}

        {sections.map((section, index) => (
          <section
            key={section.id}
            className="space-y-4 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-mono text-sm font-semibold text-foreground">
                Section {index + 1}
              </h3>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveSection(index, -1)}
                  className={buttonClass}>
                  Move up
                </button>

                <button
                  type="button"
                  disabled={index === sections.length - 1}
                  onClick={() => moveSection(index, 1)}
                  className={buttonClass}>
                  Move down
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMessage(null)
                    setSections((previous) =>
                      previous.filter((entry) => entry.id !== section.id),
                    )
                  }}
                  className={buttonClass}>
                  Remove
                </button>
              </div>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">
                Section title
              </span>

              <input
                value={section.title}
                onChange={(event) =>
                  updateSection(section.id, { title: event.target.value })
                }
                required
                maxLength={100}
                className={inputClass}
              />
            </label>

            {section.kind !== "specifications" ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">
                  {section.kind === "text"
                    ? "Description"
                    : "Features — one per line"}
                </span>

                <textarea
                  value={section.body}
                  onChange={(event) =>
                    updateSection(section.id, { body: event.target.value })
                  }
                  required
                  rows={section.kind === "text" ? 8 : 6}
                  maxLength={section.kind === "text" ? 20000 : 100100}
                  className={inputClass}
                />
              </label>
            ) : (
              <fieldset className="space-y-3">
                <legend className="mb-2 text-sm font-medium text-foreground">
                  Select specification fields
                </legend>

                <p className="text-xs text-muted">
                  Values come from the product’s saved custom fields. Selected
                  fields appear in the order you select them.
                </p>

                {fields.map((field) => (
                  <label
                    key={field.key}
                    className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={section.fieldKeys.includes(field.key)}
                      onChange={(event) =>
                        updateSection(section.id, {
                          fieldKeys: event.target.checked
                            ? [...section.fieldKeys, field.key]
                            : section.fieldKeys.filter(
                                (key) => key !== field.key,
                              ),
                        })
                      }
                      className="size-4 accent-primary"
                    />

                    {field.label}
                    {field.unit ? ` (${field.unit})` : ""}
                  </label>
                ))}
              </fieldset>
            )}
          </section>
        ))}
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? "Saving..." : "Save content sections"}
      </button>
    </form>
  )
}
