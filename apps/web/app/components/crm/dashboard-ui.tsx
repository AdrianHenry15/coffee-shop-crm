import type { ReactNode } from "react"

type MetricCardProps = {
  label: string
  value: number | string
  description?: string
}

export function MetricCard({ label, value, description }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>

      <p className="mt-3 font-mono text-3xl font-semibold tracking-tight text-primary">
        {value}
      </p>

      {description && <p className="mt-2 text-xs text-muted">{description}</p>}
    </div>
  )
}

type DashboardSectionProps = {
  title: string
  description?: string
  children: ReactNode
}

export function DashboardSection({
  title,
  description,
  children,
}: DashboardSectionProps) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-5">
        <h2 className="font-mono text-base font-semibold text-foreground">
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-sm text-muted">{description}</p>
        )}
      </div>

      {children}
    </section>
  )
}

type DashboardHeaderProps = {
  title: string
  description?: string
  action?: ReactNode
}

export function DashboardHeader({
  title,
  description,
  action,
}: DashboardHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="mb-2 font-mono text-xs font-medium uppercase tracking-widest text-primary">
          Workspace / Overview
        </p>

        <h1 className="font-mono text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>

        {description && (
          <p className="mt-2 text-sm text-muted">{description}</p>
        )}
      </div>

      {action}
    </header>
  )
}
