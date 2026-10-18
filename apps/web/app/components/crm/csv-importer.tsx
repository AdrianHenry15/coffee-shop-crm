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
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  async function importFile(file?: File) {
    setMessage(null)
    setIsError(false)

    if (!file) return

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setIsError(true)
      setMessage("Choose a CSV file.")
      return
    }

    if (file.size > MAX_CSV_BYTES) {
      setIsError(true)
      setMessage("CSV file is too large.")
      return
    }

    setIsImporting(true)

    try {
      const csvText = await file.text()
      const result = await onImport(csvText)

      setIsError(!result.success)
      setMessage(result.message)
    } catch (error) {
      setIsError(true)
      setMessage(
        error instanceof Error ? error.message : `Unable to import ${entity}.`,
      )
    } finally {
      setIsImporting(false)

      if (inputRef.current) {
        inputRef.current.value = ""
      }
    }
  }

  return (
    <div className="space-y-3">
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

      {message && (
        <p
          role={isError ? "alert" : "status"}
          className={`text-sm ${isError ? "text-red-700" : "text-green-800"}`}>
          {message}
        </p>
      )}
    </div>
  )
}
