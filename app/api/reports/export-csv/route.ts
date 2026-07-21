import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TRANSACTION_TYPE_LABELS, EXPENSE_CATEGORY_LABELS } from '@/lib/types/app'
import type { TransactionType, ExpenseCategory } from '@/lib/types/database'

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function row(cells: unknown[]): string {
  return cells.map(escapeCsv).join(',')
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('profile_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'No workspace' }, { status: 403 })
  }

  const searchParams = req.nextUrl.searchParams
  const workspaceId = membership.workspace_id
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''

  let query = supabase
    .from('financial_transactions')
    .select(
      'id, type, status, effective_date, description, amount_cents, expense_category, counterparty_reference, property_cash_effect_cents, notes, created_at'
    )
    .eq('workspace_id', workspaceId)
    .eq('status', 'posted')
    .order('effective_date', { ascending: true })

  if (from) query = query.gte('effective_date', from)
  if (to) query = query.lte('effective_date', to)

  const { data: transactions, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const headers = [
    'ID',
    'Type',
    'Date',
    'Description',
    'Amount ($)',
    'Expense Category',
    'Counterparty / Reference',
    'Property Cash Effect ($)',
    'Notes',
    'Created At',
  ]

  const lines: string[] = [headers.join(',')]

  for (const tx of transactions ?? []) {
    lines.push(
      row([
        tx.id,
        TRANSACTION_TYPE_LABELS[tx.type as TransactionType] ?? tx.type,
        tx.effective_date,
        tx.description,
        (tx.amount_cents / 100).toFixed(2),
        tx.expense_category
          ? EXPENSE_CATEGORY_LABELS[tx.expense_category as ExpenseCategory]
          : '',
        tx.counterparty_reference ?? '',
        (tx.property_cash_effect_cents / 100).toFixed(2),
        tx.notes ?? '',
        tx.created_at,
      ])
    )
  }

  const csv = lines.join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="co-ownership-report.csv"`,
    },
  })
}
