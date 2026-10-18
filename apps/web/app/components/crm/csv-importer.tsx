"use client"

import { useRef, useState } from "react"
import {
  MAX_CSV_BYTES,
  type ContactImportResult,
} from "@/app/lib/crm/csv-import"

type CsvImporterProps = {
  entity: "leads" | "customers"
  onImport: (csvText: string) => Promise<ContactImportResult>
}

export function CsvImporter({ entity, onImport }: CsvImporterProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<ContactImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function importFile(file?: File) {
    setResult(null)
    setError(null)

    if (!file) return

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Choose a CSV file.")
      return
    }

    if (file.size > MAX_CSV_BYTES) {
      setError("CSV file is too large.")
      return
    }

    setIsImporting(true)

    try {
      const csvText = await file.text()
      const importResult = await onImport(csvText)
      setResult(importResult)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : `Unable to import ${entity}.`,
      )
    } finally {
      setIsImporting(false)

      if (inputRef.current) {
        inputRef.current.value = ""
      }
    }
  }

  return (
    <div className="w-full max-w-xl space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label={`Choose a CSV file to import ${entity}`}
        onChange={(event) => importFile(event.currentTarget.files?.[0])}
      />

      <button
        type="button"
        disabled={isImporting}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          importFile(event.dataTransfer.files[0])
        }}
        className={`flex min-h-24 w-full items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          isDragging
            ? "border-green-800 bg-green-50 text-green-900"
            : "border-border bg-surface text-muted-foreground hover:border-green-800"
        }`}>
        {isImporting
          ? `Importing ${entity}...`
          : `Drop a CSV file here or click to import ${entity}`}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {result && (
        <div
          role={result.success ? "status" : "alert"}
          className="space-y-2 text-sm">
          <p className={result.success ? "text-green-800" : "text-red-700"}>
            {result.message}
          </p>

          {result.issues.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-surface p-3 text-muted">
              {result.issues.map((issue) => (
                <li key={`${issue.row}-${issue.reason}`}>
                  Row {issue.row}: {issue.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
