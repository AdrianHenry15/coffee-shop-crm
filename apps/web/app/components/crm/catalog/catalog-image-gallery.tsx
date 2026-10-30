"use client"

import Image from "next/image"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/app/lib/supabase/client"
import { optimizeCatalogImage } from "@/app/lib/catalog/optimize-image"
import { getCatalogCapacityError } from "@/app/lib/catalog/capacity-errors"

type GalleryImage = {
  id: string
  altText: string
  position: number
  url: string | null
}

type ActionResult = {
  error?: string
}

type Props = {
  organizationId: string
  itemId: string
  images: GalleryImage[]
  onSetPrimary: (imageId: string) => Promise<ActionResult>
  onRemove: (imageId: string) => Promise<ActionResult>
  onSaveAlt: (imageId: string, altText: string) => Promise<ActionResult>
}

const MAX_IMAGES = 20
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

const buttonClass =
  "rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-50"

export function CatalogImageGallery({
  organizationId,
  itemId,
  images,
  onSetPrimary,
  onRemove,
  onSaveAlt,
}: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const busyRef = useRef(false)

  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function runMutation(
    operation: () => Promise<ActionResult>,
    successMessage: string,
  ) {
    if (busyRef.current) return

    busyRef.current = true
    setBusy(true)
    setError(null)
    setMessage(null)

    try {
      const result = await operation()

      if (result.error) {
        setError(result.error)
      } else {
        setMessage(successMessage)
      }
    } catch {
      setError("Unable to update the gallery. Please try again.")
    } finally {
      router.refresh()
      busyRef.current = false
      setBusy(false)
    }
  }

  async function uploadFiles(files: File[]) {
    if (busyRef.current || files.length === 0) return

    setError(null)
    setMessage(null)

    if (images.length + files.length > MAX_IMAGES) {
      setError(
        `You can add ${Math.max(0, MAX_IMAGES - images.length)} more images.`,
      )
      return
    }

    for (const file of files) {
      if (!extensions[file.type]) {
        setError(`${file.name}: choose a JPEG, PNG, or WebP image.`)
        return
      }

      if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
        setError(`${file.name}: choose an image between 1 byte and 5 MB.`)
        return
      }
    }

    busyRef.current = true
    setBusy(true)

    let uploaded = 0

    try {
      const supabase = await createClient()
      const nextPosition =
        Math.max(-1, ...images.map((image) => image.position)) + 1

      for (const [index, file] of files.entries()) {
        const optimizedFile = await optimizeCatalogImage(file)
        const { data: reservation, error: reservationError } = await supabase
          .from("catalog_item_images")
          .insert({
            organization_id: organizationId,
            item_id: itemId,
            file_extension: extensions[optimizedFile.type],
            position: nextPosition + index,
            alt_text: "",
          })
          .select("id, object_path")
          .single()

        if (reservationError || !reservation?.object_path) {
          console.error("Unable to reserve catalog image:", reservationError)

          const capacityError = getCatalogCapacityError(reservationError)

          throw new Error(
            capacityError
              ? `${file.name}: ${capacityError}`
              : `${file.name}: unable to reserve an image slot. Check the gallery limit and your permissions.`,
          )
        }

        const { error: uploadError } = await supabase.storage
          .from("catalog-images")
          .upload(reservation.object_path, optimizedFile, {
            contentType: optimizedFile.type,
            upsert: false,
          })

        if (uploadError) {
          console.error("Unable to upload catalog image:", uploadError)

          // An interrupted response may still have uploaded the file.
          // Clean up Storage before releasing its reservation.
          const { error: cleanupError } = await supabase.storage
            .from("catalog-images")
            .remove([reservation.object_path])

          if (!cleanupError) {
            const { error: releaseError } = await supabase
              .from("catalog_item_images")
              .delete()
              .eq("id", reservation.id)
              .eq("organization_id", organizationId)
              .eq("item_id", itemId)

            if (releaseError) {
              console.error("Unable to release image slot:", releaseError)
            }
          }

          throw new Error(
            `${file.name}: upload failed. Remove any unavailable gallery entry before retrying.`,
          )
        }

        uploaded += 1
      }

      setMessage(`Uploaded ${uploaded} image${uploaded === 1 ? "" : "s"}.`)
    } catch (uploadError) {
      const detail =
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload images."

      setError(
        uploaded > 0
          ? `${uploaded} image${uploaded === 1 ? "" : "s"} uploaded. ${detail}`
          : detail,
      )
    } finally {
      if (inputRef.current) {
        inputRef.current.value = ""
      }

      router.refresh()
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <section
      aria-busy={busy}
      className="space-y-5 rounded-xl border border-border bg-surface p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h2 className="font-mono text-lg font-semibold text-foreground">
            Product images
          </h2>

          <p className="text-sm text-muted">
            JPEG, PNG, or WebP. Up to 5 MB each and 20 images per item. Your
            workspace’s total image limit also applies. Images are resized to
            fit within 2,000 × 2,000 pixels before upload.
          </p>

          <p className="text-xs text-muted">
            Images save separately from the product details.
          </p>
        </div>

        <span className="font-mono text-xs text-muted">
          {images.length}/{MAX_IMAGES}
        </span>
      </header>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        disabled={busy || images.length >= MAX_IMAGES}
        className="sr-only"
        aria-label="Choose catalog images"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? [])
          void uploadFiles(files)
        }}
      />

      <button
        type="button"
        disabled={busy || images.length >= MAX_IMAGES}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()

          if (!busy && images.length < MAX_IMAGES) {
            setDragging(true)
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          void uploadFiles(Array.from(event.dataTransfer.files))
        }}
        className={`flex min-h-28 w-full items-center justify-center rounded-xl border-2 border-dashed p-6 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          dragging
            ? "border-primary bg-primary/10 text-primary"
            : "border-border text-muted hover:border-primary"
        }`}>
        {busy
          ? "Updating gallery..."
          : images.length >= MAX_IMAGES
            ? "Gallery limit reached"
            : "Drop images here or click to choose files"}
      </button>

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

      <div className="grid gap-5 sm:grid-cols-2">
        {images.map((image, index) => (
          <article
            key={image.id}
            className="overflow-hidden rounded-xl border border-border">
            <div className="relative aspect-video bg-background">
              {image.url ? (
                <Image
                  src={image.url}
                  alt={image.altText}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 100vw, 400px"
                  className="object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted">
                  Image unavailable. Refresh previews or remove this entry.
                </div>
              )}
            </div>

            <div className="space-y-4 p-4">
              {index === 0 && (
                <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  Primary image
                </span>
              )}

              <form
                key={`${image.id}:${image.altText}`}
                onSubmit={(event) => {
                  event.preventDefault()

                  const formData = new FormData(event.currentTarget)
                  const altText = String(formData.get("altText") ?? "")

                  void runMutation(
                    () => onSaveAlt(image.id, altText),
                    "Image description saved.",
                  )
                }}
                className="space-y-2">
                <label
                  htmlFor={`alt-${image.id}`}
                  className="block text-sm font-medium text-foreground">
                  Image description
                </label>

                <input
                  id={`alt-${image.id}`}
                  name="altText"
                  defaultValue={image.altText}
                  maxLength={500}
                  disabled={busy}
                  placeholder="Describe what the image shows"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />

                <p className="text-xs text-muted">
                  Used as alternative text for accessibility.
                </p>

                <button type="submit" disabled={busy} className={buttonClass}>
                  Save description
                </button>
              </form>

              <div className="flex flex-wrap gap-2">
                {index !== 0 && (
                  <button
                    type="button"
                    disabled={busy || !image.url}
                    onClick={() =>
                      void runMutation(
                        () => onSetPrimary(image.id),
                        "Primary image updated.",
                      )
                    }
                    className={buttonClass}>
                    Make primary
                  </button>
                )}

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm("Permanently remove this image?")) {
                      return
                    }

                    void runMutation(() => onRemove(image.id), "Image removed.")
                  }}
                  className={buttonClass}>
                  Remove image
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {images.length > 0 && (
        <button
          type="button"
          disabled={busy}
          onClick={() => router.refresh()}
          className={buttonClass}>
          Refresh previews
        </button>
      )}
    </section>
  )
}
