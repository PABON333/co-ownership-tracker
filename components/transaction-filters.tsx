'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { TRANSACTION_TYPE_LABELS } from '@/lib/types/app'
import type { TransactionType } from '@/lib/types/database'

export function TransactionFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const createQueryString = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      }
      params.delete('page')
      return params.toString()
    },
    [searchParams]
  )

  const hasFilters =
    searchParams.get('type') ||
    searchParams.get('status') ||
    searchParams.get('from') ||
    searchParams.get('to')

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={searchParams.get('type') ?? ''}
        onValueChange={(v) =>
          router.push(`${pathname}?${createQueryString({ type: v === 'all' ? null : v })}`)
        }
      >
        <SelectTrigger className="w-48 h-9">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {Object.entries(TRANSACTION_TYPE_LABELS).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get('status') ?? ''}
        onValueChange={(v) =>
          router.push(`${pathname}?${createQueryString({ status: v === 'all' ? null : v })}`)
        }
      >
        <SelectTrigger className="w-36 h-9">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="posted">Posted</SelectItem>
          <SelectItem value="reversed">Reversed</SelectItem>
          <SelectItem value="voided">Voided</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Input
          type="date"
          className="h-9 w-36"
          value={searchParams.get('from') ?? ''}
          onChange={(e) =>
            router.push(`${pathname}?${createQueryString({ from: e.target.value })}`)
          }
        />
        <span className="text-muted-foreground text-sm">to</span>
        <Input
          type="date"
          className="h-9 w-36"
          value={searchParams.get('to') ?? ''}
          onChange={(e) =>
            router.push(`${pathname}?${createQueryString({ to: e.target.value })}`)
          }
        />
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1"
          onClick={() => router.push(pathname)}
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  )
}
