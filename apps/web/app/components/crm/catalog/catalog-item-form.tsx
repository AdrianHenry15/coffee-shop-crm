"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type {
  CatalogAttributes,
  CatalogField,
  CreateCatalogItemResult,
} from "@/app/lib/catalog/types"

type TemplateOption = {
  versionId: string
  name: string
  kind: string
  fields: CatalogField[]
}

type InitialCatalogItem = {
  templateVersionId: string
  name: string
  slug: string
  summary: string
  attributes: CatalogAttributes
}

type CatalogItemFormProps = {
  templates: TemplateOption[]
  returnUrl: string
  initialItem?: InitialCatalogItem
  onSave: (formData: FormData) => Promise<CreateCatalogItemResult>
}

const inputClassName =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"

function createSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "")
}

export function CatalogItemForm({
  templates,
  returnUrl,
  initialItem,
  onSave,
}: CatalogItemFormProps) {
  const router = useRouter()

  const [templateVersionId, setTemplateVersionId] = useState(
    initialItem?.templateVersionId ?? templates[0]?.versionId ?? "",
  )
  const [name, setName] = useState(initialItem?.name ?? "")
  const [itemSlug, setItemSlug] = useState(initialItem?.slug ?? "")
  const [slugEdited, setSlugEdited] = useState(Boolean(initialItem))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const initialAttributes = initialItem?.attributes ?? {}

  const template = templates.find(
    (entry) => entry.versionId === templateVersionId,
  )

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isPending || !template) return

    setError(null)

    const formData = new FormData(event.currentTarget)
    const attributes: CatalogAttributes = {}

    for (const field of template.fields) {
      const inputName = `attribute:${field.key}`

      if (field.type === "boolean") {
        attributes[field.key] = formData.has(inputName)
        continue
      }

      if (field.type === "multiselect") {
        const values = formData
          .getAll(inputName)
          .filter((value): value is string => typeof value === "string")

        if (values.length > 0) {
          attributes[field.key] = values
        }

        continue
      }

      const value = String(formData.get(inputName) ?? "").trim()

      // Drafts may leave fields empty, including fields required to publish.
      if (!value) continue

      if (field.type === "number") {
        const number = Number(value)

        if (!Number.isFinite(number)) {
          setError(`Enter a valid number for ${field.label}.`)
          return
        }

        attributes[field.key] = number
      } else {
        attributes[field.key] = value
      }
    }

    formData.set("attributes", JSON.stringify(attributes))

    startTransition(async () => {
      try {
        const result = await onSave(formData)

        if (result.error || !result.itemId) {
          setError(result.error ?? "Unable to save the draft.")
          return
        }

        router.push(returnUrl)
        router.refresh()
      } catch {
        setError("Unable to save the draft. Please try again.")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset disabled={isPending} className="space-y-6 disabled:opacity-60">
        <section className="space-y-5 rounded-xl border border-border bg-surface p-6">
          <h2 className="font-mono text-lg font-semibold text-foreground">
            Item details
          </h2>

          <div className="space-y-2">
            <label
              htmlFor="templateVersionId"
              className="text-sm font-medium text-foreground">
              Template
            </label>

            <select
              id="templateVersionId"
              name="templateVersionId"
              value={templateVersionId}
              disabled={Boolean(initialItem)}
              onChange={(event) => {
                setTemplateVersionId(event.target.value)
                setError(null)
              }}
              required
              className={inputClassName}>
              {templates.map((entry) => (
                <option key={entry.versionId} value={entry.versionId}>
                  {entry.name} ({entry.kind})
                </option>
              ))}
            </select>

            <p className="text-xs text-muted">
              The template determines this item’s custom fields. It cannot be
              changed after the item is created.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="name"
              className="text-sm font-medium text-foreground">
              Name
            </label>

            <input
              id="name"
              name="name"
              value={name}
              onChange={(event) => {
                const value = event.target.value
                setName(value)

                if (!slugEdited) {
                  setItemSlug(createSlug(value))
                }
              }}
              required
              maxLength={200}
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="slug"
              className="text-sm font-medium text-foreground">
              Slug
            </label>

            <input
              id="slug"
              name="slug"
              value={itemSlug}
              onChange={(event) => {
                setSlugEdited(true)
                setItemSlug(event.target.value)
              }}
              required
              maxLength={120}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              spellCheck={false}
              autoCapitalize="none"
              className={inputClassName}
            />

            <p className="text-xs text-muted">
              A unique identifier within this workspace, such as
              exterior-house-wash.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="summary"
              className="text-sm font-medium text-foreground">
              Summary
            </label>

            <textarea
              id="summary"
              defaultValue={initialItem?.summary ?? ""}
              name="summary"
              maxLength={500}
              rows={3}
              className={inputClassName}
            />
          </div>
        </section>

        <section
          key={templateVersionId}
          className="space-y-5 rounded-xl border border-border bg-surface p-6">
          <div className="space-y-2">
            <h2 className="font-mono text-lg font-semibold text-foreground">
              Custom fields
            </h2>

            <p className="text-sm text-muted">
              Fields marked “Required to publish” can remain empty while saving
              a draft.
            </p>
          </div>

          {!template?.fields.length && (
            <p className="text-sm text-muted">
              This template has no custom fields.
            </p>
          )}

          {template?.fields.map((field) => {
            const id = `attribute-${field.key}`
            const inputName = `attribute:${field.key}`
            const helpId = `${id}-help`
            const initialValue = initialAttributes[field.key]

            return (
              <div key={field.key} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor={field.type === "multiselect" ? undefined : id}
                    id={`${id}-label`}
                    className="text-sm font-medium text-foreground">
                    {field.label}
                    {field.unit ? ` (${field.unit})` : ""}
                  </label>

                  {field.required && (
                    <span className="text-xs text-muted">
                      Required to publish
                    </span>
                  )}
                </div>

                {field.group && (
                  <p className="text-xs text-muted">{field.group}</p>
                )}

                {field.type === "text" && (
                  <input
                    id={id}
                    name={inputName}
                    defaultValue={
                      typeof initialValue === "string" ? initialValue : ""
                    }
                    type="text"
                    maxLength={500}
                    aria-describedby={field.help ? helpId : undefined}
                    className={inputClassName}
                  />
                )}

                {field.type === "multiline" && (
                  <textarea
                    id={id}
                    name={inputName}
                    defaultValue={
                      typeof initialValue === "string" ? initialValue : ""
                    }
                    rows={4}
                    maxLength={5000}
                    aria-describedby={field.help ? helpId : undefined}
                    className={inputClassName}
                  />
                )}

                {field.type === "number" && (
                  <input
                    id={id}
                    name={inputName}
                    defaultValue={
                      typeof initialValue === "number" ? initialValue : ""
                    }
                    type="number"
                    step="any"
                    aria-describedby={field.help ? helpId : undefined}
                    className={inputClassName}
                  />
                )}

                {field.type === "boolean" && (
                  <div className="flex items-center gap-2">
                    <input
                      id={id}
                      defaultChecked={initialValue === true}
                      name={inputName}
                      type="checkbox"
                      aria-describedby={field.help ? helpId : undefined}
                      className="size-4 accent-primary"
                    />

                    <span className="text-sm text-muted">
                      Checked means yes; unchecked means no.
                    </span>
                  </div>
                )}

                {field.type === "select" && (
                  <select
                    id={id}
                    name={inputName}
                    defaultValue=""
                    aria-describedby={field.help ? helpId : undefined}
                    className={inputClassName}>
                    <option value="">Choose an option</option>

                    {field.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}

                {field.type === "multiselect" && (
                  <div
                    role="group"
                    aria-labelledby={`${id}-label`}
                    aria-describedby={field.help ? helpId : undefined}
                    className="space-y-2 rounded-lg border border-border p-3">
                    {field.options?.map((option, index) => (
                      <label
                        key={option}
                        htmlFor={`${id}-${index}`}
                        className="flex items-center gap-2 text-sm text-foreground">
                        <input
                          id={`${id}-${index}`}
                          name={inputName}
                          defaultChecked={
                            Array.isArray(initialValue) &&
                            initialValue.includes(option)
                          }
                          type="checkbox"
                          value={option}
                          className="size-4 accent-primary"
                        />

                        {option}
                      </label>
                    ))}
                  </div>
                )}

                {field.help && (
                  <p id={helpId} className="text-xs text-muted">
                    {field.help}
                  </p>
                )}
              </div>
            )
          })}
        </section>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed">
            {isPending
              ? "Saving..."
              : initialItem
                ? "Save changes"
                : "Save draft"}
          </button>

          <Link
            href={returnUrl}
            className="rounded-lg border border-border px-5 py-3 text-sm font-medium text-foreground">
            Cancel
          </Link>
        </div>
      </fieldset>
    </form>
  )
}
