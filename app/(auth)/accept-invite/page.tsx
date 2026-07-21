import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  const { token, error } = await searchParams

  if (!token && !error) {
    redirect('/sign-in')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accept invitation</CardTitle>
        <CardDescription>You&apos;ve been invited to join a Co-Ownership Tracker workspace.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="text-center space-y-3">
            <p className="text-destructive">
              The invitation link is invalid or has expired. Please ask a workspace member to
              re-invite you.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/sign-in">Go to sign in</Link>
            </Button>
          </div>
        ) : user ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <p>
              You are signed in as <strong>{user.email}</strong>. Your account has been linked to
              the workspace.
            </p>
            <Button asChild className="w-full">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <p className="text-muted-foreground">
              Please sign up or sign in to accept this invitation.
            </p>
            <div className="flex gap-3">
              <Button asChild className="flex-1">
                <Link href={`/sign-up?invite=${token}`}>Sign up</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href={`/sign-in?invite=${token}`}>Sign in</Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
