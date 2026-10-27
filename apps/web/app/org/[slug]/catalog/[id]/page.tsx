import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getCatalogAccess } from "@/app/lib/catalog/access"
import type { CatalogAttributes, CatalogField } from "@/app/lib/catalog/types"
import { CatalogPublicationControls } from "@/app/components/crm/catalog/catalog-publication-controls"
import {
  publishCatalogItem,
  unpublishCatalogItem,
} from "../publication-actions"
import { parseCatalogSections } from "@/app/lib/catalog/sections"

function formatAttribute(
  value: CatalogAttributes[string] | undefined,
  unit?: string,
) {
  if (value === undefined || value === "" || value === null) {
    return null
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : null
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No"
  }

  return unit ? `${value} ${unit}` : String(value)
}

export default async function CatalogItemPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    notFound()
  }

  const { supabase, organization, canManage } = await getCatalogAccess(slug)

  const { data: item, error: itemError } = await supabase
    .from("catalog_items")
    .select(
      "id, name, slug, summary, status, attributes, template_version_id, price_mode, price_cents, currency",
    )
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle()

  if (itemError) {
    throw new Error("Unable to load the catalog item.")
  }

  if (!item) {
    notFound()
  }

  const [versionResult, imagesResult, sectionsResult] = await Promise.all([
    supabase
      .from("catalog_template_versions")
      .select("fields")
      .eq("id", item.template_version_id)
      .eq("organization_id", organization.id)
      .single(),

    supabase
      .from("catalog_item_images")
      .select("id, object_path, alt_text, position, created_at")
      .eq("item_id", item.id)
      .eq("organization_id", organization.id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),

    supabase
      .from("catalog_item_sections")
      .select("id, title, kind, content")
      .eq("item_id", item.id)
      .eq("organization_id", organization.id)
      .order("position", { ascending: true })
      .order("id", { ascending: true }),
  ])

  if (versionResult.error || !versionResult.data) {
    throw new Error("Unable to load the item's field definitions.")
  }

  if (imagesResult.error) {
    throw new Error("Unable to load catalog images.")
  }

  if (sectionsResult.error) {
    throw new Error("Unable to load catalog content sections.")
  }

  const sections = parseCatalogSections(sectionsResult.data ?? [])

  const fields = versionResult.data.fields as unknown as CatalogField[]
  const attributes = item.attributes as CatalogAttributes

  const fieldByKey = new Map(fields.map((field) => [field.key, field]))

  const sectionFieldKeys = new Set(
    sections.flatMap((section) =>
      section.kind === "specifications" ? section.content.field_keys : [],
    ),
  )

  const remainingFields = fields.filter(
    (field) => !sectionFieldKeys.has(field.key),
  )

  const images = imagesResult.data ?? []

  const paths = images
    .map((image) => image.object_path)
    .filter((path): path is string => typeof path === "string")

  const signedUrls = new Map<string, string>()

  if (paths.length > 0) {
    const { data, error } = await supabase.storage
      .from("catalog-images")
      .createSignedUrls(paths, 3600)

    if (error) {
      console.error("Unable to load catalog image previews:", error)
    }

    for (const image of data ?? []) {
      if (image.path && image.signedUrl && !image.error) {
        signedUrls.set(image.path, image.signedUrl)
      }
    }
  }

  const missingFields = fields.filter(
    (field) =>
      field.required &&
      formatAttribute(attributes[field.key], field.unit) === null,
  )

  const price =
    item.price_cents === null
      ? null
      : new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: item.currency,
        }).format(item.price_cents / 100)

  const priceLabel =
    item.price_mode === "quote"
      ? "Request a quote"
      : price
        ? `${item.price_mode === "starting_at" ? "Starting at " : ""}${price}`
        : "Price unavailable"

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <Link
          href={`/org/${slug}/catalog`}
          className="text-sm text-primary hover:underline">
          ← Catalog
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <h1 className="font-mono text-3xl font-semibold text-foreground">
              {item.name}
            </h1>

            {item.summary && (
              <p className="max-w-3xl whitespace-pre-wrap text-sm text-muted">
                {item.summary}
              </p>
            )}

            <p className="text-xl font-semibold text-foreground">
              {priceLabel}
            </p>
          </div>

          <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs capitalize text-primary">
            {item.status}
          </span>
        </div>

        <p className="text-xs text-muted">
          Workspace preview. Public website access is configured separately.
        </p>
      </header>

      {images.length > 0 && (
        <section aria-label="Item images" className="grid gap-4 sm:grid-cols-2">
          {images.map((image, index) => {
            const url = image.object_path
              ? signedUrls.get(image.object_path)
              : null

            if (!url) return null

            return (
              <figure
                key={image.id}
                className={`overflow-hidden rounded-xl border border-border bg-surface ${
                  index === 0 ? "sm:col-span-2" : ""
                }`}>
                <div className="relative aspect-video">
                  <Image
                    src={url}
                    alt={image.alt_text}
                    fill
                    unoptimized
                    sizes={
                      index === 0
                        ? "(max-width: 768px) 100vw, 1000px"
                        : "(max-width: 640px) 100vw, 500px"
                    }
                    className="object-contain p-4"
                  />
                </div>
              </figure>
            )
          })}
        </section>
      )}

      {sections.map((section) => (
        <section
          key={section.id}
          className="space-y-4 rounded-xl border border-border bg-surface p-6">
          <h2 className="font-mono text-lg font-semibold text-foreground">
            {section.title}
          </h2>

          {section.kind === "text" && (
            <p className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-muted">
              {section.content.text}
            </p>
          )}

          {section.kind === "list" && (
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
              {section.content.items.map((entry, index) => (
                <li key={index} className="wrap-break-word">
                  {entry}
                </li>
              ))}
            </ul>
          )}

          {section.kind === "specifications" && (
            <dl className="divide-y divide-border">
              {section.content.field_keys.map((key) => {
                const field = fieldByKey.get(key)

                if (!field) return null

                const value = formatAttribute(attributes[key], field.unit)

                return (
                  <div
                    key={key}
                    className="grid gap-2 py-3 sm:grid-cols-3 sm:gap-6">
                    <dt className="text-sm font-medium text-foreground">
                      {field.label}
                    </dt>

                    <dd className="whitespace-pre-wrap wrap-break-word text-sm text-muted sm:col-span-2">
                      {value ??
                        (field.required
                          ? "Missing — required to publish"
                          : "—")}
                    </dd>
                  </div>
                )
              })}
            </dl>
          )}
        </section>
      ))}

      {remainingFields.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="font-mono text-lg font-semibold text-foreground">
            Details
          </h2>

          <dl className="mt-4 divide-y divide-border">
            {remainingFields.map((field) => {
              const value = formatAttribute(attributes[field.key], field.unit)

              return (
                <div
                  key={field.key}
                  className="grid gap-2 py-4 sm:grid-cols-3 sm:gap-6">
                  <dt className="text-sm font-medium text-foreground">
                    {field.label}
                    {field.group && (
                      <span className="mt-1 block text-xs font-normal text-muted">
                        {field.group}
                      </span>
                    )}
                  </dt>

                  <dd className="whitespace-pre-wrap wrap-break-word text-sm text-muted sm:col-span-2">
                    {value ??
                      (field.required ? "Missing — required to publish" : "—")}
                  </dd>
                </div>
              )
            })}
          </dl>
        </section>
      )}

      {canManage && item.status === "draft" && missingFields.length > 0 && (
        <p role="status" className="text-sm text-muted">
          Complete these fields before publishing:{" "}
          {missingFields.map((field) => field.label).join(", ")}.
        </p>
      )}

      {canManage &&
        (item.status === "draft" || item.status === "published") && (
          <CatalogPublicationControls
            key={item.status}
            status={item.status}
            editUrl={`/org/${slug}/catalog/${item.id}/edit`}
            onChangeStatus={
              item.status === "draft"
                ? publishCatalogItem.bind(null, slug, item.id)
                : unpublishCatalogItem.bind(null, slug, item.id)
            }
          />
        )}
    </div>
  )
}
