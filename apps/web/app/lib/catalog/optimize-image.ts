const MAX_DIMENSION = 2000
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const WEBP_QUALITY = 0.85

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export async function optimizeCatalogImage(file: File): Promise<File> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(`${file.name}: choose a JPEG, PNG, or WebP image.`)
  }

  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${file.name}: images must be between 1 byte and 5 MB.`)
  }

  let bitmap: ImageBitmap

  try {
    bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    })
  } catch {
    throw new Error(`${file.name}: this image could not be opened.`)
  }

  const canvas = document.createElement("canvas")

  try {
    const scale = Math.min(
      1,
      MAX_DIMENSION / bitmap.width,
      MAX_DIMENSION / bitmap.height,
    )

    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))

    const context = canvas.getContext("2d")

    if (!context) {
      throw new Error("Your browser could not prepare the image.")
    }

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result)
          } else {
            reject(new Error(`${file.name}: image conversion failed.`))
          }
        },
        "image/webp",
        WEBP_QUALITY,
      )
    })

    // Keep an already-small original if conversion offers no savings.
    if (scale === 1 && blob.size >= file.size) {
      return file
    }

    // Browsers may fall back to PNG when an encoder is unavailable.
    if (!ALLOWED_TYPES.has(blob.type)) {
      throw new Error(`${file.name}: unsupported image conversion.`)
    }

    if (blob.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        `${file.name}: the resized image is still too large. Choose a smaller image.`,
      )
    }

    const extension = blob.type === "image/webp" ? "webp" : "png"
    const baseName = file.name.replace(/\.[^.]+$/, "") || "catalog-image"

    return new File([blob], `${baseName}.${extension}`, {
      type: blob.type,
      lastModified: file.lastModified,
    })
  } finally {
    bitmap.close()

    // Release the canvas backing memory after processing.
    canvas.width = 0
    canvas.height = 0
  }
}
