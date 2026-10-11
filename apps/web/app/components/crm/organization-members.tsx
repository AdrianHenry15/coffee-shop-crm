type Member = {
  id: string
  role: string
  status: string
  user_id: string
  name: string | null
}

type Props = {
  members: Member[]
  currentUserId: string
}

export function OrganizationMembers({ members, currentUserId }: Props) {
  return (
    <section className="space-y-6 rounded-xl border border-border bg-surface p-6">
      <div>
        <h2 className="font-mono text-lg font-semibold text-foreground">
          Team members
        </h2>

        <p className="mt-1 text-sm text-muted">
          People associated with this organization and their access roles.
        </p>
      </div>

      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-secondary px-5 py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            No organization members found
          </p>

          <p className="mt-1 text-xs text-muted">
            Members associated with your organization will appear here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-semibold text-primary">
                  {(member.name?.trim() || "?").charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 space-y-1">
                  <p className="wrap-break-word text-sm font-medium text-foreground">
                    {member.name ?? "Unnamed member"}

                    {member.user_id === currentUserId && (
                      <span className="ml-2 text-xs font-normal text-muted">
                        (You)
                      </span>
                    )}
                  </p>

                  <p
                    className={`text-xs font-medium capitalize ${
                      member.status === "active" ? "text-primary" : "text-muted"
                    }`}>
                    {member.status.replaceAll("_", " ")}
                  </p>
                </div>
              </div>

              <span className="rounded-full border border-border bg-surface-secondary px-3 py-1 font-mono text-xs font-medium capitalize text-foreground">
                {member.role.replaceAll("_", " ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
