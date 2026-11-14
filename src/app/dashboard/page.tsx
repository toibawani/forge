"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CardSkeleton } from "@/components/Skeleton";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [views, setViews] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select(`
              profile_views_count,
              streaks (
                current_streak
              )
            `)
            .eq("id", user.id)
            .single();

          const { count } = await supabase
            .from("challenge_attempts")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id);

          setStreak(profile?.streaks?.[0]?.current_streak || 0);
          setViews(profile?.profile_views_count || 0);
          setAttempts(count || 0);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
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
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Forge
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </>
          ) : (
            <>
              <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-medium mb-2">Your Streak</h2>
                <p className="text-4xl font-bold text-primary">{streak}</p>
                <p className="text-sm text-muted-foreground mt-1">Current streak</p>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-medium mb-2">Challenges Completed</h2>
                <p className="text-4xl font-bold text-primary">{attempts}</p>
                <p className="text-sm text-muted-foreground mt-1">Total attempts</p>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-medium mb-2">Profile Views</h2>
                <p className="text-4xl font-bold text-primary">{views}</p>
                <p className="text-sm text-muted-foreground mt-1">Recruiter interest</p>
              </div>
            </>
          )}
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
