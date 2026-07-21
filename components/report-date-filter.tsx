'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export function ReportDateFilter({
  defaultFrom,
  defaultTo,
}: {
  defaultFrom: string
  defaultTo: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set(key, value)
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const currentYear = new Date().getFullYear()

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <Label className="text-sm whitespace-nowrap">From:</Label>
        <Input
          type="date"
          className="h-9 w-36"
          defaultValue={defaultFrom}
          onChange={(e) => update('from', e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-sm whitespace-nowrap">To:</Label>
        <Input
          type="date"
          className="h-9 w-36"
          defaultValue={defaultTo}
          onChange={(e) => update('to', e.target.value)}
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const params = new URLSearchParams(searchParams.toString())
          params.set('from', `${currentYear}-01-01`)
          params.set('to', `${currentYear}-12-31`)
          router.push(`${pathname}?${params.toString()}`)
        }}
      >
        This Year
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const params = new URLSearchParams(searchParams.toString())
          params.delete('from')
          params.delete('to')
          router.push(`${pathname}?${params.toString()}`)
        }}
      >
        All Time
      </Button>
    </div>
  )
}
