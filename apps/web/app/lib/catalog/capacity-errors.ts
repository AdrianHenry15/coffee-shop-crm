export function getCatalogCapacityError(error: unknown): string | null {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    !("message" in error) ||
    error.code !== "P0001" ||
    typeof error.message !== "string"
  ) {
    return null
  }

  switch (error.message) {
    case "Catalog limit reached for templates":
      return (
        "Your workspace has reached its catalog template limit. " +
        "Archived templates also count. Review your plan or contact support."
      )

    case "Catalog limit reached for template_versions":
      return (
        "This template has reached its saved-version limit. " +
        "Contact support before creating another version."
      )

    case "Catalog limit reached for items":
      return (
        "Your workspace has reached its catalog item limit. " +
        "Draft and archived items also count. Review your plan or contact support."
      )

    case "Catalog limit reached for image_slots":
      return (
        "Your workspace has reached its catalog image limit. " +
        "Unused upload reservations and stored files also count. " +
        "Remove unused images or contact support."
      )

    case "Catalog limit reached for sections":
      return "This item has reached its content-section limit."

    default:
      return null
  }
}
