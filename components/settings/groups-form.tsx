'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, CheckCircle, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { WorkspaceActionState } from '@/app/actions/workspace'

interface Group {
  id: string
  name: string
  display_order: number
  active: boolean
}

interface Props {
  groups: Group[]
  renameAction: (groupId: string, newName: string) => Promise<WorkspaceActionState>
}

function GroupRow({
  group,
  renameAction,
}: {
  group: Group
  renameAction: (groupId: string, newName: string) => Promise<WorkspaceActionState>
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(group.name)
  const [isPending, startTransition] = useTransition()

  const save = () => {
    if (!name.trim() || name.trim() === group.name) {
      setEditing(false)
      setName(group.name)
      return
    }
    startTransition(async () => {
      const result = await renameAction(group.id, name.trim())
      if (result.error) {
        toast.error(result.error)
        setName(group.name)
      } else {
        toast.success('Group renamed.')
      }
      setEditing(false)
    })
  }

  return (
    <div className="flex items-center gap-2 py-2 border-b last:border-0">
      {editing ? (
        <>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') {
                setEditing(false)
                setName(group.name)
              }
            }}
            className="h-8 text-sm flex-1"
          />
          <Button size="icon" variant="ghost" onClick={save} disabled={isPending} className="h-8 w-8">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 text-green-600" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => { setEditing(false); setName(group.name) }}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm font-medium">{name}</span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setEditing(true)}
            className="h-8 w-8 text-muted-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  )
}

export function SettingsGroupsForm({ groups, renameAction }: Props) {
  return (
    <div className="space-y-0">
      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">No ownership groups found.</p>
      )}
      {groups.map((g) => (
        <GroupRow key={g.id} group={g} renameAction={renameAction} />
      ))}
    </div>
  )
}
