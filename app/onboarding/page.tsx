'use client'

import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { createWorkspace } from '@/app/actions/workspace'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Home, Users, Shield, ChevronRight, ChevronLeft, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { LEGAL_DISCLAIMER } from '@/lib/types/app'

const STEPS = [
  { id: 1, title: 'Property Details', icon: Home },
  { id: 2, title: 'Disclaimer', icon: Shield },
  { id: 3, title: 'Ownership Groups', icon: Users },
  { id: 4, title: 'Complete', icon: CheckCircle2 },
]

const DEFAULT_GROUPS = [
  { name: 'Andrea & Alvaro', description: 'Shared ownership group' },
  { name: 'Marc & Paola', description: 'Shared ownership group' },
  { name: 'Ana', description: 'Individual owner' },
  { name: 'Gustavo', description: 'Individual owner' },
]

const initialState = {}

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false)
  const [state, action, isPending] = useActionState(createWorkspace, initialState)
  const router = useRouter()

  if (state.success) {
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Home className="h-7 w-7 text-primary" />
            <span className="text-2xl font-semibold tracking-tight">Co-Ownership Tracker</span>
          </div>
          <p className="text-muted-foreground">Set up your family property workspace</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  step === s.id
                    ? 'bg-primary text-primary-foreground'
                    : step > s.id
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {step > s.id ? <CheckCircle2 className="h-4 w-4" /> : s.id}
              </div>
              <span className={`text-sm hidden sm:block ${step === s.id ? 'font-medium' : 'text-muted-foreground'}`}>
                {s.title}
              </span>
              {i < STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Property Details</CardTitle>
              <CardDescription>Tell us about the property you&apos;re co-owning.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="property_name">Property name *</Label>
                <Input
                  id="property_name"
                  name="property_name"
                  placeholder="e.g. Family Home — Chicago"
                  defaultValue="Family Property"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address (optional)</Label>
                <Input id="address" name="address" placeholder="e.g. 123 Main St, Chicago, IL 60601" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchase_date">Purchase date (optional)</Label>
                  <Input id="purchase_date" name="purchase_date" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_price">Purchase price (optional)</Label>
                  <Input id="purchase_price" name="purchase_price" type="text" placeholder="$0.00" />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={() => setStep(2)}>
                  Continue <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Important Disclaimer
              </CardTitle>
              <CardDescription>Please read and acknowledge before continuing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="font-semibold">Internal Accounting Tool Only</AlertTitle>
                <AlertDescription className="mt-2 text-sm leading-relaxed">
                  {LEGAL_DISCLAIMER}
                </AlertDescription>
              </Alert>

              <div className="rounded-lg border p-4 space-y-3 text-sm text-muted-foreground">
                <p>This application:</p>
                <ul className="space-y-2 ml-4 list-disc">
                  <li>Tracks internal capital-account estimates for family accounting purposes</li>
                  <li>Does <strong>not</strong> represent legal ownership, deed records, or title</li>
                  <li>Does <strong>not</strong> provide tax, legal, or financial advice</li>
                  <li>Does <strong>not</strong> allocate mortgage liability</li>
                  <li>Should be used alongside a co-ownership agreement prepared by an attorney</li>
                </ul>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="disclaimer"
                  checked={disclaimerAcknowledged}
                  onCheckedChange={(v) => setDisclaimerAcknowledged(v === true)}
                />
                <Label htmlFor="disclaimer" className="text-sm leading-relaxed cursor-pointer">
                  I understand that calculated ownership shares are internal accounting estimates
                  only and do not replace legal agreements, deed records, or professional advice.
                </Label>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={() => setStep(3)} disabled={!disclaimerAcknowledged}>
                  I Acknowledge <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Ownership Groups</CardTitle>
              <CardDescription>
                The following four ownership groups will be created. You can rename them later in
                Settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {DEFAULT_GROUPS.map((group, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{group.name}</p>
                      <p className="text-sm text-muted-foreground">{group.description}</p>
                    </div>
                    <Badge variant="secondary">Group {i + 1}</Badge>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="text-sm text-muted-foreground space-y-1">
                <p>After setup, you can:</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>Rename any ownership group</li>
                  <li>Add family members to groups via the Settings page</li>
                  <li>Invite members by email</li>
                </ul>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <form action={action}>
                  <input type="hidden" name="property_name" value="Family Property" />
                  <input type="hidden" name="disclaimer_acknowledged" value="true" />
                  <Button type="submit" disabled={isPending}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Workspace <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </div>

              {state.error && (
                <Alert variant="destructive">
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
