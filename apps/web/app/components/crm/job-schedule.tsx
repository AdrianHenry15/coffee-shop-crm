"use client"

import { formatLocalDateTime } from "@/app/lib/dates"
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

export function JobSchedule({ slug, jobs }: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))

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
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">
          {formatDate(weekStart)} –{" "}
          {weekEnd.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </h2>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => changeWeek(-1)}
            className="rounded-md border px-4 py-2">
            ←
          </button>

          <button
            type="button"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="rounded-md border px-4 py-2 text-sm">
            Today
          </button>

          <button
            type="button"
            onClick={() => changeWeek(1)}
            className="rounded-md border px-4 py-2">
            →
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        {days.map((day) => {
          const dayJobs = jobs
            .filter((job) => {
              const date = new Date(job.scheduled_start)

              return (
                date.getFullYear() === day.getFullYear() &&
                date.getMonth() === day.getMonth() &&
                date.getDate() === day.getDate()
              )
            })
            .sort(
              (a, b) =>
                new Date(a.scheduled_start).getTime() -
                new Date(b.scheduled_start).getTime(),
            )

          const isToday = day.toDateString() === new Date().toDateString()

          return (
            <div
              key={day.toISOString()}
              className={`min-h-44 space-y-3 rounded-lg border p-3 ${
                isToday ? "border-black" : ""
              }`}>
              <div className="border-b pb-2">
                <p className="text-xs text-gray-500">
                  {day.toLocaleDateString("en-US", {
                    weekday: "short",
                  })}
                </p>

                <p className="font-semibold">{day.getDate()}</p>
              </div>

              {dayJobs.length === 0 ? (
                <p className="text-xs text-gray-400">No jobs</p>
              ) : (
                dayJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/org/${slug}/jobs/${job.id}`}
                    className="block space-y-1 rounded-md border p-2 hover:bg-gray-50">
                    <p className="text-xs font-semibold">{job.title}</p>

                    <p className="text-xs text-gray-500">
                      {formatLocalDateTime(job.scheduled_start)}
                    </p>

                    <p className="truncate text-xs text-gray-500">
                      {job.customerName}
                    </p>

                    <p className="text-xs">
                      {statusLabels[job.status] ?? job.status}
                    </p>
                  </Link>
                ))
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
