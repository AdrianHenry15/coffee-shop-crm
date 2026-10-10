type PipelineItem = {
  label: string
  count: number
}

type Props = {
  leads: PipelineItem[]
  estimates: PipelineItem[]
  jobs: PipelineItem[]
}

function PipelineSection({
  title,
  items,
}: {
  title: string
  items: PipelineItem[]
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-mono text-sm font-semibold text-foreground">
          {title}
        </h3>

        <span className="rounded-md bg-surface-secondary px-2 py-1 font-mono text-xs text-muted">
          {total} total
        </span>
      </div>

      <div className="space-y-4">
        {items.map((item) => {
          const percentage = total > 0 ? (item.count / total) * 100 : 0

          return (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted">{item.label}</span>

                <span className="font-mono font-medium tabular-nums text-foreground">
                  {item.count}
                </span>
              </div>

              <div
                className="h-2 overflow-hidden rounded-full bg-surface-secondary"
                role="progressbar"
                aria-label={`${title}: ${item.label}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(percentage)}>
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PipelineOverview({ leads, estimates, jobs }: Props) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 md:p-6">
      <div className="mb-6">
        <h2 className="font-mono text-base font-semibold text-foreground">
          Pipeline Overview
        </h2>

        <p className="mt-1 text-sm text-muted">
          Track progress across your CRM
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <PipelineSection title="Leads" items={leads} />
        <PipelineSection title="Estimates" items={estimates} />
        <PipelineSection title="Jobs" items={jobs} />
      </div>
    </section>
  )
}
