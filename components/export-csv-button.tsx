'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ExportCsvButtonProps {
  workspaceId: string
  from: string
  to: string
}

export function ExportCsvButton({ workspaceId, from, to }: ExportCsvButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ workspace_id: workspaceId, from, to })
      const response = await fetch(`/api/reports/export-csv?${params.toString()}`)
      if (!response.ok) throw new Error('Export failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `co-ownership-report-${from}-${to}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report exported.')
    } catch {
      toast.error('Failed to export report.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
      Export CSV
    </Button>
  )
}
