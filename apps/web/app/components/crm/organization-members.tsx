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
    <section className="max-w-xl space-y-5 rounded-lg border p-6">
      <div>
        <h2 className="font-semibold">Team Members</h2>
        <p className="mt-1 text-sm text-gray-500">
          People associated with this organization.
        </p>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-gray-500">No organization members found.</p>
      ) : (
        <div className="divide-y">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {member.name ?? "Unnamed Member"}
                  {member.user_id === currentUserId && " (You)"}
                </p>

                <p className="text-xs capitalize text-gray-500">
                  {member.status}
                </p>
              </div>

              <span className="rounded-md border px-3 py-1 text-xs capitalize">
                {member.role}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
