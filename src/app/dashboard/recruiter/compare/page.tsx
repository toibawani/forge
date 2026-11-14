"use client";

import { useState } from "react";
import Link from "next/link";

export default function ComparePage() {
  const [candidateIds, setCandidateIds] = useState<string[]>([]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Compare Candidates</h1>
          <Link
            href="/dashboard/recruiter"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium mb-4">Select Candidates to Compare</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Candidate {i}</span>
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCandidateIds([...candidateIds, `candidate-${i}`]);
                      } else {
                        setCandidateIds(candidateIds.filter((id) => id !== `candidate-${i}`));
                      }
                    }}
                  />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Streak:</span>
                    <span className="font-medium">{5 + i * 3}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Score:</span>
                    <span className="font-medium">{75 + i * 2}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Attempts:</span>
                    <span className="font-medium">{10 + i * 5}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {candidateIds.length >= 2 && (
          <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-medium mb-6">Comparison Results</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4">Metric</th>
                    {candidateIds.map((id) => (
                      <th key={id} className="text-left py-3 px-4">
                        {id.replace("candidate-", "Candidate ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="py-3 px-4">Current Streak</td>
                    {candidateIds.map((id, i) => (
                      <td key={id} className="py-3 px-4 font-medium">
                        {5 + i * 3} days
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="py-3 px-4">Longest Streak</td>
                    {candidateIds.map((id, i) => (
                      <td key={id} className="py-3 px-4 font-medium">
                        {10 + i * 5} days
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="py-3 px-4">Average Score</td>
                    {candidateIds.map((id, i) => (
                      <td key={id} className="py-3 px-4 font-medium">
                        {75 + i * 2}%
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="py-3 px-4">Total Attempts</td>
                    {candidateIds.map((id, i) => (
                      <td key={id} className="py-3 px-4 font-medium">
                        {10 + i * 5}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-4">Last Practice</td>
                    {candidateIds.map((id, i) => (
                      <td key={id} className="py-3 px-4 font-medium">
                        {i === 0 ? "Today" : i === 1 ? "Yesterday" : `${i} days ago`}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
