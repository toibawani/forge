import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="space-y-6">
          <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Profile Visibility</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Who can see your profile?</label>
                <select className="mt-2 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-background px-3 py-2 text-sm">
                  <option value="private">Private - Only you</option>
                  <option value="recruiters_only">Recruiters Only</option>
                  <option value="public">Public - Everyone</option>
                </select>
                <p className="text-xs text-muted-foreground mt-2">
                  Recruiter-only allows verified recruiters to find you, but not the general public.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Allow recruiter contact</label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Recruiters can send you messages
                  </p>
                </div>
                <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary transition-colors">
                  <span className="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition-transform" />
                </button>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Profile Information</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Display Name</label>
                <input
                  type="text"
                  placeholder="Your name"
                  className="mt-2 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Bio</label>
                <textarea
                  placeholder="Tell recruiters about yourself"
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Skills</label>
                <input
                  type="text"
                  placeholder="react, python, design (comma-separated)"
                  className="mt-2 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity">
              Save Changes
            </button>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Data</h2>
            <div className="space-y-4">
              <button className="w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Export my data
              </button>
              <button className="w-full text-left rounded-lg border border-destructive text-destructive px-4 py-3 text-sm hover:bg-destructive/10 transition-colors">
                Delete my account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
