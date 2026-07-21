import { Home } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <div className="mb-8 flex items-center gap-2">
        <Home className="h-6 w-6 text-primary" />
        <span className="text-xl font-semibold tracking-tight">Co-Ownership Tracker</span>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
