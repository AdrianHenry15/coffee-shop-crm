export type ContactImportRow = {
  name: string
  email: string
  phone: string
  notes: string
}

export type ContactImportResult = {
  success: boolean
  imported: number
  message: string
}

export const MAX_CSV_BYTES = 700 * 1024
export const MAX_IMPORT_ROWS = 500

function parseCsvRows(source: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]

    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }

      continue
    }

    if (character === '"' && field.trim() === "") {
      field = ""
      quoted = true
    } else if (character === ",") {
      row.push(field)
      field = ""
    } else if (character === "\n" || character === "\r") {
      row.push(field)

      if (row.some((value) => value.trim() !== "")) {
        rows.push(row)
      }

      row = []
      field = ""

      if (character === "\r" && source[index + 1] === "\n") {
        index += 1
      }
    } else {
      field += character
    }
  }

  if (quoted) {
    throw new Error("The CSV has an opening quote without a matching quote.")
  }

  row.push(field)

  if (row.some((value) => value.trim() !== "")) {
    rows.push(row)
  }

  return rows
}

export function parseContactCsv(source: string): ContactImportRow[] {
  const parsedRows = parseCsvRows(source)

  if (parsedRows.length < 2) {
    throw new Error("The CSV needs a header row and at least one contact.")
  }

  const aliases = new Map<string, keyof ContactImportRow>([
    ["name", "name"],
    ["fullname", "name"],
    ["leadname", "name"],
    ["customername", "name"],
    ["email", "email"],
    ["emailaddress", "email"],
    ["phone", "phone"],
    ["phonenumber", "phone"],
    ["notes", "notes"],
    ["note", "notes"],
    ["description", "notes"],
  ])

  const headers = parsedRows[0].map((header) =>
    header
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, ""),
  )

  const columnIndexes = new Map<keyof ContactImportRow, number>()

  headers.forEach((header, index) => {
    const field = aliases.get(header)

    if (field && !columnIndexes.has(field)) {
      columnIndexes.set(field, index)
    }
  })

  if (!columnIndexes.has("name")) {
    throw new Error("The CSV needs a name column.")
  }

  const dataRows = parsedRows.slice(1)

  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Import up to ${MAX_IMPORT_ROWS} contacts at a time.`)
  }

  return dataRows.map((values) => ({
    name: (values[columnIndexes.get("name") ?? -1] ?? "").trim(),
    email: (values[columnIndexes.get("email") ?? -1] ?? "").trim(),
    phone: (values[columnIndexes.get("phone") ?? -1] ?? "").trim(),
    notes: (values[columnIndexes.get("notes") ?? -1] ?? "").trim(),
  }))
}

export function validateContactImportRows(rows: ContactImportRow[]) {
  const errors: string[] = []

  rows.forEach((row, index) => {
    const rowNumber = index + 2

    if (!row.name || row.name.length > 200) {
      errors.push(`Row ${rowNumber}: enter a name up to 200 characters.`)
    }

    if (
      row.email &&
      (row.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))
    ) {
      errors.push(`Row ${rowNumber}: check the email address.`)
    }

    if (row.phone.length > 50) {
      errors.push(`Row ${rowNumber}: phone must be 50 characters or fewer.`)
    }

    if (row.notes.length > 5000) {
      errors.push(`Row ${rowNumber}: notes must be 5,000 characters or fewer.`)
    }
  })

  return errors
}
