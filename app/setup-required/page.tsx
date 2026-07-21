import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function SetupRequiredPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Co-Ownership Tracker</h1>
          <p className="text-muted-foreground">Setup required before you can use this app.</p>
        </div>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Supabase environment variables not configured</AlertTitle>
          <AlertDescription>
            This application requires a Supabase project. Authentication and data persistence are
            not functional without configuration.
          </AlertDescription>
        </Alert>

        <div className="bg-card border rounded-lg p-6 space-y-4">
          <h2 className="font-semibold text-lg">Setup Instructions</h2>

          <ol className="space-y-4 text-sm">
            <li className="space-y-1">
              <p className="font-medium">1. Create a Supabase project</p>
              <p className="text-muted-foreground">
                Go to{' '}
                <code className="bg-muted px-1 rounded text-xs">supabase.com</code> and create a
                new project.
              </p>
            </li>

            <li className="space-y-1">
              <p className="font-medium">2. Set environment variables</p>
              <p className="text-muted-foreground">
                Copy <code className="bg-muted px-1 rounded text-xs">.env.local.example</code> to{' '}
                <code className="bg-muted px-1 rounded text-xs">.env.local</code> and fill in your
                project URL and anon key from the Supabase dashboard (Settings → API).
              </p>
              <pre className="bg-muted rounded p-3 text-xs overflow-auto mt-2">
{`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`}
              </pre>
            </li>

            <li className="space-y-1">
              <p className="font-medium">3. Run database migrations</p>
              <p className="text-muted-foreground">
                In the Supabase dashboard, open the SQL Editor and run each migration file in order:
              </p>
              <ul className="mt-1 space-y-1 text-muted-foreground ml-4">
                <li>
                  <code className="bg-muted px-1 rounded text-xs">
                    supabase/migrations/001_initial_schema.sql
                  </code>
                </li>
                <li>
                  <code className="bg-muted px-1 rounded text-xs">
                    supabase/migrations/002_rls_policies.sql
                  </code>
                </li>
                <li>
                  <code className="bg-muted px-1 rounded text-xs">
                    supabase/migrations/003_functions.sql
                  </code>
                </li>
              </ul>
            </li>

            <li className="space-y-1">
              <p className="font-medium">4. Configure authentication redirect URLs</p>
              <p className="text-muted-foreground">
                In the Supabase dashboard, go to Authentication → URL Configuration and add your
                app URL (e.g.{' '}
                <code className="bg-muted px-1 rounded text-xs">http://localhost:3000</code>) to
                the allowed redirect URLs. Also set:
              </p>
              <pre className="bg-muted rounded p-3 text-xs overflow-auto mt-2">
{`Site URL: http://localhost:3000
Redirect URLs: http://localhost:3000/auth/callback`}
              </pre>
            </li>

            <li className="space-y-1">
              <p className="font-medium">5. Restart the development server</p>
              <p className="text-muted-foreground">
                After setting environment variables, restart with{' '}
                <code className="bg-muted px-1 rounded text-xs">npm run dev</code>.
              </p>
            </li>
          </ol>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          For detailed instructions see the README.md file in this project.
        </p>
      </div>
    </div>
  )
}
