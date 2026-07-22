import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  updateWorkspaceDetails,
  updateEquityPolicy,
  renameOwnershipGroup,
  inviteMember,
} from '@/app/actions/workspace'
import { formatCentsAsCurrency } from '@/lib/financial/calculations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'
import { LEGAL_DISCLAIMER } from '@/lib/types/app'
import { SettingsPropertyForm } from '@/components/settings/property-form'
import { SettingsGroupsForm } from '@/components/settings/groups-form'
import { SettingsPolicyForm } from '@/components/settings/policy-form'
import { SettingsInviteForm } from '@/components/settings/invite-form'
import { format, parseISO } from 'date-fns'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('profile_id', user.id)
    .single()
  if (!membership) redirect('/onboarding')

  const workspaceId = membership.workspace_id
  const params = await searchParams

  const [{ data: workspace }, { data: groups }, { data: policyVersions }, { data: members }] =
    await Promise.all([
      supabase.from('property_workspace').select('*').eq('id', workspaceId).single(),
      supabase
        .from('ownership_groups')
        .select('id, name, display_order, active')
        .eq('workspace_id', workspaceId)
        .order('display_order'),
      supabase
        .from('equity_policy_versions')
        .select('id, policy_data, effective_at, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('workspace_members')
        .select('profile_id, profiles(full_name, email)')
        .eq('workspace_id', workspaceId),
    ])

  if (!workspace) redirect('/onboarding')

  const currentPolicy = (policyVersions ?? [])[0]?.policy_data as {
    mortgage_interest_credits_payer: boolean
    mortgage_escrow_credits_payer: boolean
    property_cash_expense_credits_groups: boolean
    retained_rental_income_allocation: string
  } | null

  const activeGroups = (groups ?? []).filter((g) => g.active)

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage property details, groups, and equity policy.
        </p>
      </div>

      <Tabs defaultValue={params.tab ?? 'property'}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="property">Property</TabsTrigger>
          <TabsTrigger value="groups">Ownership Groups</TabsTrigger>
          <TabsTrigger value="policy">Equity Policy</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="disclaimer">Disclaimer</TabsTrigger>
        </TabsList>

        {/* Property details */}
        <TabsContent value="property" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Property Details</CardTitle>
              <CardDescription>Update your property and mortgage information.</CardDescription>
            </CardHeader>
            <CardContent>
              <SettingsPropertyForm
                workspaceId={workspaceId}
                defaultValues={{
                  property_name: workspace.property_name,
                  address: workspace.address ?? '',
                  purchase_date: workspace.purchase_date ?? '',
                  purchase_price_cents: workspace.purchase_price_cents ?? undefined,
                  lender_name: workspace.lender_name ?? '',
                  primary_borrower_label: workspace.primary_borrower_label ?? '',
                  original_loan_amount_cents: workspace.original_loan_amount_cents ?? undefined,
                  loan_notes: workspace.loan_notes ?? '',
                }}
                updateAction={updateWorkspaceDetails}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ownership Groups */}
        <TabsContent value="groups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ownership Groups</CardTitle>
              <CardDescription>
                Rename groups. Names appear in transaction records and reports.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SettingsGroupsForm
                groups={activeGroups}
                renameAction={renameOwnershipGroup}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Equity Policy */}
        <TabsContent value="policy" className="space-y-4">
          <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs">
              Changing equity policy creates a new policy version. Existing posted transactions
              retain their original policy snapshot — only future transactions use the new policy.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Equity Policy</CardTitle>
              <CardDescription>
                Controls how contributions, expenses, and mortgage payments affect capital accounts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SettingsPolicyForm
                workspaceId={workspaceId}
                currentPolicy={currentPolicy}
                updateAction={updateEquityPolicy}
              />
            </CardContent>
          </Card>

          {/* Policy version history */}
          {(policyVersions?.length ?? 0) > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Policy History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(policyVersions ?? []).map((v, i) => {
                  const p = v.policy_data as typeof currentPolicy
                  return (
                    <div key={v.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="text-sm">
                        <span className="font-medium">
                          {format(parseISO(v.created_at), 'MMM d, yyyy')}
                        </span>
                        {i === 0 && (
                          <Badge variant="secondary" className="ml-2 text-xs">Current</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Rental: {p?.retained_rental_income_allocation ?? '—'}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Members */}
        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Members</CardTitle>
              <CardDescription>Family members with access to this workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(members ?? []).map((m) => {
                  const profile = m.profiles as unknown as { full_name: string | null; email: string } | null
                  return (
                    <div key={m.profile_id} className="flex items-center gap-3 py-2 border-b last:border-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                        {(profile?.full_name ?? profile?.email ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {profile?.full_name ?? '(No name)'}
                        </p>
                        <p className="text-xs text-muted-foreground">{profile?.email}</p>
                      </div>
                      {profile?.email === user.email && (
                        <Badge variant="outline" className="ml-auto text-xs">You</Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invite a Member</CardTitle>
              <CardDescription>
                Send an invitation email to add someone to this workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SettingsInviteForm groups={activeGroups} inviteAction={inviteMember} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Disclaimer */}
        <TabsContent value="disclaimer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Legal Disclaimer</CardTitle>
              <CardDescription>
                This disclaimer is shown to all users on the ownership and reports pages.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm leading-relaxed">
                  {LEGAL_DISCLAIMER}
                </AlertDescription>
              </Alert>
              <p className="text-xs text-muted-foreground mt-4">
                Workspace created {format(parseISO(workspace.created_at), 'MMMM d, yyyy')}.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
