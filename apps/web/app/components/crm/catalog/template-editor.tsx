"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import type {
  CatalogField,
  CatalogFieldType,
  CreateTemplateResult,
} from "@/app/lib/catalog/types"

type EditableField = {
  id: string
  key: string
  label: string
  type: CatalogFieldType
  required: boolean
  help: string
  group: string
  unit: string
  optionsText: string
}

type Props = {
  returnUrl: string
  initialTemplate?: {
    name: string
    description: string
    kind: "product" | "service"
    fields: CatalogField[]
  }
  onSave: (formData: FormData) => Promise<CreateTemplateResult>
}

const fieldTypes: { value: CatalogFieldType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "multiline", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Yes / No" },
  { value: "select", label: "Single selection" },
  { value: "multiselect", label: "Multiple selections" },
]

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"

const secondaryButton =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-50"

function makeFieldKey(label: string) {
  const key = label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")

  if (!key) return ""

  return (/^[a-z]/.test(key) ? key : `field_${key}`).slice(0, 64)
}

export function TemplateEditor({ returnUrl, initialTemplate, onSave }: Props) {
  const router = useRouter()

  const [fields, setFields] = useState<EditableField[]>(() =>
    (initialTemplate?.fields ?? []).map((field) => ({
      id: field.key,
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      help: field.help ?? "",
      group: field.group ?? "",
      unit: field.unit ?? "",
      optionsText: field.options?.join("\n") ?? "",
    })),
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function addField() {
    if (fields.length >= 50) return

    setFields((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        key: "",
        label: "",
        type: "text",
        required: false,
        help: "",
        group: "",
        unit: "",
        optionsText: "",
      },
    ])
  }

  function updateField(id: string, changes: Partial<EditableField>) {
    setFields((previous) =>
      previous.map((field) =>
        field.id === id ? { ...field, ...changes } : field,
      ),
    )
  }

  function moveField(index: number, direction: -1 | 1) {
    const destination = index + direction

    if (destination < 0 || destination >= fields.length) return

    setFields((previous) => {
      const next = [...previous]
      ;[next[index], next[destination]] = [next[destination], next[index]]
      return next
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (pending) return

    setError(null)

    const definitions: CatalogField[] = []
    const keys = new Set<string>()

    for (const field of fields) {
      const key = field.key.trim()
      const label = field.label.trim()

      if (!label || !/^[a-z][a-z0-9_]{0,63}$/.test(key) || keys.has(key)) {
        setError(
          "Each field needs a label and a unique key starting with a letter. Keys can contain lowercase letters, numbers, and underscores.",
        )
        return
      }

      keys.add(key)

      const definition: CatalogField = {
        key,
        label,
        type: field.type,
        required: field.required,
      }

      if (field.help.trim()) {
        definition.help = field.help.trim()
      }

      if (field.group.trim()) {
        definition.group = field.group.trim()
      }

      if (field.type === "number" && field.unit.trim()) {
        definition.unit = field.unit.trim()
      }

      if (field.type === "select" || field.type === "multiselect") {
        const options = [
          ...new Set(
            field.optionsText
              .split(/\r?\n/)
              .map((option) => option.trim())
              .filter(Boolean),
          ),
        ]

        if (
          options.length === 0 ||
          options.length > 100 ||
          options.some((option) => option.length > 100)
        ) {
          setError(`"${label}" needs 1–100 options, each up to 100 characters.`)
          return
        }

        definition.options = options
      }

      definitions.push(definition)
    }

    const formData = new FormData(event.currentTarget)
    formData.set("fields", JSON.stringify(definitions))

    startTransition(async () => {
      try {
        const result = await onSave(formData)

        if (result.error) {
          setError(result.error)
          return
        }

        if (result.templateId) {
          router.push(returnUrl)
          router.refresh()
        }
      } catch {
        setError("Unable to save the template. Please try again.")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset disabled={pending} className="space-y-6">
        <legend className="sr-only">Catalog template</legend>

        <section className="space-y-5 rounded-xl border border-border bg-surface p-6">
          <h2 className="font-mono text-lg font-semibold text-foreground">
            Template details
          </h2>

          <div className="space-y-2">
            <label
              htmlFor="template-name"
              className="block text-sm font-medium text-foreground">
              Template name
            </label>

            <input
              id="template-name"
              defaultValue={initialTemplate?.name ?? ""}
              name="name"
              required
              maxLength={100}
              placeholder="Battery mower or Exterior cleaning"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="template-kind"
              className="block text-sm font-medium text-foreground">
              Item type
            </label>

            <select
              id="template-kind"
              name="kind"
              defaultValue={initialTemplate?.kind ?? "product"}
              disabled={Boolean(initialTemplate)}
              className={inputClass}>
              <option value="product">Product</option>
              <option value="service">Service</option>
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="template-description"
              className="block text-sm font-medium text-foreground">
              Description{" "}
              <span className="font-normal text-muted">(optional)</span>
            </label>

            <textarea
              id="template-description"
              name="description"
              rows={3}
              maxLength={2000}
              className={inputClass}
              defaultValue={initialTemplate?.description ?? ""}
            />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-mono text-lg font-semibold text-foreground">
                Custom fields
              </h2>

              <p className="mt-1 text-sm text-muted">
                Define the information collected for each item.
              </p>
            </div>

            <button
              type="button"
              onClick={addField}
              disabled={fields.length >= 50}
              className={secondaryButton}>
              Add field ({fields.length}/50)
            </button>
          </div>

          {fields.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">
              No custom fields yet. Add specifications such as cutting width,
              power source, service area, or duration.
            </p>
          )}

          {fields.map((field, index) => (
            <div
              key={field.id}
              className="space-y-4 rounded-xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-mono text-sm font-semibold text-foreground">
                  Field {index + 1}
                </h3>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveField(index, -1)}
                    className={secondaryButton}>
                    Move up
                  </button>

                  <button
                    type="button"
                    disabled={index === fields.length - 1}
                    onClick={() => moveField(index, 1)}
                    className={secondaryButton}>
                    Move down
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setFields((previous) =>
                        previous.filter((entry) => entry.id !== field.id),
                      )
                    }
                    className={secondaryButton}>
                    Remove
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-foreground">
                  <span className="block font-medium">Label</span>

                  <input
                    value={field.label}
                    required
                    maxLength={100}
                    placeholder="Cutting width"
                    onChange={(event) => {
                      const label = event.target.value
                      const key =
                        field.key === makeFieldKey(field.label)
                          ? makeFieldKey(label)
                          : field.key

                      updateField(field.id, { label, key })
                    }}
                    className={inputClass}
                  />
                </label>

                <label className="space-y-2 text-sm text-foreground">
                  <span className="block font-medium">Field type</span>

                  <select
                    value={field.type}
                    onChange={(event) =>
                      updateField(field.id, {
                        type: event.target.value as CatalogFieldType,
                      })
                    }
                    className={inputClass}>
                    {fieldTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm text-foreground">
                  <span className="block font-medium">Field key</span>

                  <input
                    value={field.key}
                    required
                    maxLength={64}
                    pattern="[a-z][a-z0-9_]*"
                    onChange={(event) =>
                      updateField(field.id, { key: event.target.value })
                    }
                    className={inputClass}
                  />

                  <span className="block text-xs text-muted">
                    Stable identifier, such as cutting_width.
                  </span>
                </label>

                <label className="space-y-2 text-sm text-foreground">
                  <span className="block font-medium">Group (optional)</span>

                  <input
                    value={field.group}
                    maxLength={100}
                    placeholder="Specifications or Dimensions"
                    onChange={(event) =>
                      updateField(field.id, { group: event.target.value })
                    }
                    className={inputClass}
                  />
                </label>

                {field.type === "number" && (
                  <label className="space-y-2 text-sm text-foreground">
                    <span className="block font-medium">Unit (optional)</span>

                    <input
                      value={field.unit}
                      maxLength={30}
                      placeholder="mm, kg, hours"
                      onChange={(event) =>
                        updateField(field.id, { unit: event.target.value })
                      }
                      className={inputClass}
                    />
                  </label>
                )}
              </div>

              {(field.type === "select" || field.type === "multiselect") && (
                <label className="block space-y-2 text-sm text-foreground">
                  <span className="block font-medium">
                    Options — one per line
                  </span>

                  <textarea
                    value={field.optionsText}
                    required
                    rows={4}
                    maxLength={10100}
                    placeholder={"Battery\nPetrol\nDiesel"}
                    onChange={(event) =>
                      updateField(field.id, {
                        optionsText: event.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </label>
              )}

              <label className="block space-y-2 text-sm text-foreground">
                <span className="block font-medium">Help text (optional)</span>

                <input
                  value={field.help}
                  maxLength={500}
                  placeholder="Instructions shown when editing an item"
                  onChange={(event) =>
                    updateField(field.id, { help: event.target.value })
                  }
                  className={inputClass}
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(event) =>
                    updateField(field.id, {
                      required: event.target.checked,
                    })
                  }
                  className="size-4 accent-primary"
                />
                Required before publishing an item
              </label>
            </div>
          ))}
        </section>
      </fieldset>

      <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
        <p className="text-sm text-muted">
          {initialTemplate
            ? "Saving creates a new active version for new items. Existing products and services keep their original field definitions."
            : "Activating this template makes it available for new items. Future field changes create a new version."}
        </p>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
          {pending
            ? "Saving..."
            : initialTemplate
              ? "Save and activate new version"
              : "Create and activate template"}
        </button>
      </div>
    </form>
  )
}
