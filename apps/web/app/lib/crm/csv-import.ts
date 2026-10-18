export type ContactImportRow = {
  lineNumber: number
  name: string
  email: string
  phone: string
  notes: string
}

export type ContactImportIssue = {
  row: number
  reason: string
}

export type ContactImportResult = {
  success: boolean
  imported: number
  skipped: number
  issues: ContactImportIssue[]
  message: string
}

export const MAX_CSV_BYTES = 700 * 1024
export const MAX_IMPORT_ROWS = 500

type ParsedCsvRow = {
  lineNumber: number
  values: string[]
}

function parseCsvRows(source: string): ParsedCsvRow[] {
  const rows: ParsedCsvRow[] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  let lineNumber = 1
  let rowStartLine = 1

  function finishRow() {
    row.push(field)

    if (row.some((value) => value.trim() !== "")) {
      rows.push({ lineNumber: rowStartLine, values: row })
    }

    row = []
    field = ""
  }

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]

    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else if (character === "\r" || character === "\n") {
        if (character === "\r" && source[index + 1] === "\n") {
          field += "\r\n"
          index += 1
        } else {
          field += character
        }

        lineNumber += 1
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
    } else if (character === "\r" || character === "\n") {
      finishRow()

      if (character === "\r" && source[index + 1] === "\n") {
        index += 1
      }

      lineNumber += 1
      rowStartLine = lineNumber
    } else {
      field += character
    }
  }

  if (quoted) {
    throw new Error("The CSV has an opening quote without a matching quote.")
  }

  if (row.length > 0 || field.trim() !== "") {
    finishRow()
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
    ["contactname", "name"],
    ["leadname", "name"],
    ["customername", "name"],
    ["email", "email"],
    ["emailaddress", "email"],
    ["phone", "phone"],
    ["phonenumber", "phone"],
    ["notes", "notes"],
    ["note", "notes"],
    ["description", "notes"],
    ["address", "notes"],
  ])

  const headers = parsedRows[0].values.map((header) =>
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

  return dataRows.map(({ lineNumber, values }) => ({
    lineNumber,
    name: (values[columnIndexes.get("name")!] ?? "").trim(),
    email: (values[columnIndexes.get("email")!] ?? "").trim(),
    phone: (values[columnIndexes.get("phone")!] ?? "").trim(),
    notes: (values[columnIndexes.get("notes")!] ?? "").trim(),
  }))
}

export function validateContactImportRows(rows: ContactImportRow[]) {
  const validRows: ContactImportRow[] = []
  const issues: ContactImportIssue[] = []

  for (const row of rows) {
    const reasons: string[] = []

    if (!row.name || row.name.length > 200) {
      reasons.push("Enter a name up to 200 characters.")
    }

    if (
      row.email &&
      (row.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))
    ) {
      reasons.push("Check the email address.")
    }

    if (row.phone.length > 50) {
      reasons.push("Phone must be 50 characters or fewer.")
    }

    if (row.notes.length > 5000) {
      reasons.push("Notes must be 5,000 characters or fewer.")
    }

    if (reasons.length > 0) {
      issues.push({
        row: row.lineNumber,
        reason: reasons.join(" "),
      })
    } else {
      validRows.push(row)
    }
  }

  return { validRows, issues }
}
