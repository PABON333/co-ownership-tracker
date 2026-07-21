'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { postReversal } from '@/app/actions/transactions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'

const initialState = {}

export function ReversalForm({ transactionId }: { transactionId: string }) {
  const router = useRouter()
  const [state, action, isPending] = useActionState(postReversal, initialState)

  useEffect(() => {
    if (state.success && state.transactionId) {
      toast.success('Reversal posted.')
      router.push(`/transactions/${state.transactionId}`)
    }
  }, [state.success, state.transactionId, router])

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="original_transaction_id" value={transactionId} />

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="reversal_date">Reversal Effective Date *</Label>
        <Input
          id="reversal_date"
          name="effective_date"
          type="date"
          defaultValue={new Date().toISOString().split('T')[0]}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reversal_reason">Reason for Reversal *</Label>
        <Textarea
          id="reversal_reason"
          name="reversal_reason"
          placeholder="Explain why this transaction needs to be reversed..."
          rows={3}
          minLength={10}
          required
        />
      </div>

      <Button type="submit" variant="destructive" disabled={isPending}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Post Reversal
      </Button>
    </form>
  )
}
