import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Forge
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-medium mb-2">Your Streak</h2>
            <p className="text-4xl font-bold text-primary">0</p>
            <p className="text-sm text-muted-foreground mt-1">Current streak</p>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-medium mb-2">Challenges Completed</h2>
            <p className="text-4xl font-bold text-primary">0</p>
            <p className="text-sm text-muted-foreground mt-1">Total attempts</p>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-medium mb-2">Profile Views</h2>
            <p className="text-4xl font-bold text-primary">0</p>
            <p className="text-sm text-muted-foreground mt-1">Recruiter interest</p>
          </div>
        </div>

        <div className="mt-8 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Quick Actions</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Start a Challenge
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-foreground hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Update Profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
