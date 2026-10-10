"use client"

import { toZonedTime } from "date-fns-tz"
import Link from "next/link"
import { useState } from "react"

type Job = {
  id: string
  title: string
  status: string
  customerName: string
  scheduled_start: string
  scheduled_end: string | null
}

type Props = {
  slug: string
  timezone: string
  jobs: Job[]
}

const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  canceled: "Canceled",
}

function startOfWeek(date: Date) {
  const result = new Date(date)

  result.setHours(0, 0, 0, 0)

  const day = (result.getDay() + 6) % 7

  result.setDate(result.getDate() - day)

  return result
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function getDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

export function JobSchedule({ slug, timezone, jobs }: Props) {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(toZonedTime(new Date(), timezone)),
  )
  function changeWeek(amount: number) {
    setWeekStart((current) => {
      const next = new Date(current)
      next.setDate(next.getDate() + amount * 7)
      return next
    })
  }

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + index)
    return date
  })

  const weekEnd = days[6]

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-xs font-medium uppercase tracking-widest text-primary">
            Weekly schedule
          </p>

          <h2 className="font-mono text-xl font-semibold text-foreground">
            {formatDate(weekStart)} –{" "}
            {weekEnd.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </h2>

          <p className="mt-1 text-sm text-muted">
            View and manage scheduled customer jobs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => changeWeek(-1)}
            aria-label="Previous week"
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-secondary">
            ←
          </button>

          <button
            type="button"
            onClick={() =>
              setWeekStart(startOfWeek(toZonedTime(new Date(), timezone)))
            }
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-secondary">
            Today
          </button>

          <button
            type="button"
            onClick={() => changeWeek(1)}
            aria-label="Next week"
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-secondary">
            →
          </button>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[770px] grid-cols-7 gap-3">
          {days.map((day) => {
            const dayJobs = jobs
              .filter((job) => {
                const date = toZonedTime(job.scheduled_start, timezone)

                return getDateKey(date) === getDateKey(day)
              })
              .sort(
                (a, b) =>
                  new Date(a.scheduled_start).getTime() -
                  new Date(b.scheduled_start).getTime(),
              )

            const isToday =
              day.toDateString() ===
              toZonedTime(new Date(), timezone).toDateString()

            return (
              <div
                key={getDateKey(day)}
                className={`min-h-56 space-y-3 rounded-xl border p-3 ${
                  isToday
                    ? "border-primary bg-primary/5"
                    : "border-border bg-surface"
                }`}>
                <div className="border-b border-border pb-3">
                  <p
                    className={`font-mono text-xs font-medium uppercase ${
                      isToday ? "text-primary" : "text-muted"
                    }`}>
                    {day.toLocaleDateString("en-US", {
                      weekday: "short",
                    })}
                  </p>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span
                      className={`font-mono text-xl font-semibold ${
                        isToday ? "text-primary" : "text-foreground"
                      }`}>
                      {day.getDate()}
                    </span>

                    {dayJobs.length > 0 && (
                      <span className="rounded-full bg-surface-secondary px-2 py-0.5 font-mono text-xs text-muted">
                        {dayJobs.length}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {dayJobs.length === 0 ? (
                    <p className="py-3 text-center text-xs text-muted">
                      No jobs
                    </p>
                  ) : (
                    dayJobs.map((job) => (
                      <Link
                        key={job.id}
                        href={`/org/${slug}/jobs/${job.id}`}
                        className="block space-y-2 rounded-lg border border-border bg-surface-secondary p-3 transition-colors hover:border-primary">
                        <p className="wrap-break-word text-xs font-semibold text-foreground">
                          {job.title}
                        </p>

                        <p className="font-mono text-xs text-primary">
                          {formatTime(job.scheduled_start, timezone)}
                        </p>

                        <p className="truncate text-xs text-muted">
                          {job.customerName}
                        </p>

                        <span className="inline-block rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
                          {statusLabels[job.status] ?? job.status}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
