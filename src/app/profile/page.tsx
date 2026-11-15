"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data } = await supabase
            .from("challenge_attempts")
            .select("score, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(30);

          setAttempts(data || []);
        }
      } catch (error) {
        console.error("Failed to fetch profile data", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Skill Timeline</h1>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-medium mb-6">Recent Challenge Attempts</h2>
          {loading ? (
            <div className="text-sm text-muted-foreground text-center py-8">Loading...</div>
          ) : attempts.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No attempts yet. Start your first challenge!
            </div>
          ) : (
            <div className="space-y-3">
              {attempts.map((attempt, i) => (
                <div key={i} className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">{attempt.score}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Challenge {attempts.length - i}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(attempt.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm">
                    {attempt.score >= 80 ? (
                      <span className="text-green-600">Excellent</span>
                    ) : attempt.score >= 60 ? (
                      <span className="text-yellow-600">Good</span>
                    ) : (
                      <span className="text-red-600">Needs Practice</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
