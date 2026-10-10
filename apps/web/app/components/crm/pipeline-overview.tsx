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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>

        <span className="text-sm text-gray-500">{total} total</span>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const percentage = total > 0 ? (item.count / total) * 100 : 0

          return (
            <div key={item.label} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{item.label}</span>
                <span>{item.count}</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                {" "}
                <div
                  className="h-full rounded-full bg-blue-500"
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
    <section className="rounded-lg border p-6">
      <h2 className="mb-6 text-lg font-semibold">Pipeline Overview</h2>

      <div className="grid gap-8 md:grid-cols-3">
        <PipelineSection title="Leads" items={leads} />

        <PipelineSection title="Estimates" items={estimates} />

        <PipelineSection title="Jobs" items={jobs} />
      </div>
    </section>
  )
}
