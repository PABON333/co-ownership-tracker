'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { forgotPassword, type AuthActionState } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2 } from 'lucide-react'

const initialState: AuthActionState = {}

export default function ForgotPasswordPage() {
  const [state, action, isPending] = useActionState(forgotPassword, initialState)

  if (state.success) {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
          <h2 className="text-xl font-semibold">Check your email</h2>
          <p className="text-muted-foreground">
            If an account exists for that email, we sent a password reset link.
          </p>
          <Link href="/sign-in" className="text-primary hover:underline text-sm">
            Return to sign in
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>Enter your email to receive a password reset link.</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="space-y-4">
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            {state.fieldErrors?.email && (
              <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send reset link
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            <Link href="/sign-in" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
