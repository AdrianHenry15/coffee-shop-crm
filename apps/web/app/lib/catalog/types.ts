export type CatalogFieldType =
  | "text"
  | "multiline"
  | "number"
  | "boolean"
  | "select"
  | "multiselect"

export type CatalogField = {
  key: string
  label: string
  type: CatalogFieldType
  required: boolean
  help?: string
  group?: string
  unit?: string
  options?: string[]
}

export type CreateTemplateResult = {
  error?: string
  templateId?: string
}

export type CatalogAttributes = Record<
  string,
  string | number | boolean | string[]
>

export type CreateCatalogItemResult = {
  error?: string
  itemId?: string
}
