import Link from "next/link";

export default function RecruiterDashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Recruiter Dashboard</h1>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Forge
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium">Search Candidates</h2>
                <button className="text-sm text-primary hover:opacity-90">Advanced Filters</button>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <input
                  type="text"
                  placeholder="Skills (e.g., react, python)"
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-background px-3 py-2 text-sm"
                />
                <select className="rounded-lg border border-gray-200 dark:border-gray-700 bg-background px-3 py-2 text-sm">
                  <option>All Difficulties</option>
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </select>
                <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity">
                  Search
                </button>
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4">Recent Candidates</h2>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground text-center py-8">
                  Search for candidates to see results here
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium">Your Pipelines</h2>
                <button className="text-sm text-primary hover:opacity-90">+ New</button>
              </div>
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground text-center py-4">
                  No pipelines yet
                </div>
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4">Saved Candidates</h2>
              <div className="text-sm text-muted-foreground text-center py-4">
                0 candidates saved
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
