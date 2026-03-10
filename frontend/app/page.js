"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE = "http://127.0.0.1:8000";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function StatCard({ title, value, subtext, tone = "default" }) {
  const tones = {
    default: "border-slate-800 bg-slate-900",
    blue: "border-blue-900/60 bg-blue-950/30",
    green: "border-emerald-900/60 bg-emerald-950/30",
    amber: "border-amber-900/60 bg-amber-950/30",
    purple: "border-violet-900/60 bg-violet-950/30",
  };

  return (
    <div className={cx("rounded-2xl border p-5 shadow-sm", tones[tone])}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <h3 className="mt-2 text-3xl font-bold text-white">{value ?? "-"}</h3>
      {subtext ? <p className="mt-1 text-sm text-slate-500">{subtext}</p> : null}
    </div>
  );
}

function SectionCard({ title, subtitle, children, rightSlot }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 shadow-[0_0_0_1px_rgba(255,255,255,0.01)] backdrop-blur">
      <div className="flex flex-col gap-3 border-b border-slate-800 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
        </div>
        {rightSlot}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Badge({ children, tone = "default" }) {
  const tones = {
    default: "border-slate-700 bg-slate-800 text-slate-200",
    green: "border-emerald-800 bg-emerald-950/60 text-emerald-300",
    blue: "border-blue-800 bg-blue-950/60 text-blue-300",
    amber: "border-amber-800 bg-amber-950/60 text-amber-300",
    red: "border-red-800 bg-red-950/60 text-red-300",
    purple: "border-violet-800 bg-violet-950/60 text-violet-300",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

function MiniBar({ label, value, total, tone = "blue" }) {
  const width = total > 0 ? Math.max(6, Math.round((value / total) * 100)) : 0;

  const toneMap = {
    blue: "from-blue-400 to-blue-600",
    green: "from-emerald-400 to-emerald-600",
    amber: "from-amber-400 to-amber-600",
    red: "from-red-400 to-red-600",
    purple: "from-violet-400 to-violet-600",
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="text-sm font-semibold text-white">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={cx("h-full rounded-full bg-gradient-to-r", toneMap[tone])}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(String(value).replace(/,/g, ""));
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(num);
}

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const [summaryRes, jobsRes] = await Promise.all([
          fetch(`${API_BASE}/dashboard-summary`, { cache: "no-store" }),
          fetch(`${API_BASE}/jobs`, { cache: "no-store" }),
        ]);

        if (!summaryRes.ok) throw new Error("Failed to load dashboard summary");
        if (!jobsRes.ok) throw new Error("Failed to load jobs");

        const summaryJson = await summaryRes.json();
        const jobsJson = await jobsRes.json();

        setSummary(summaryJson);
        setJobs(Array.isArray(jobsJson) ? jobsJson : []);
      } catch (err) {
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const filteredJobs = useMemo(() => {
    if (!search.trim()) return jobs;
    const q = search.toLowerCase();

    return jobs.filter((job) => {
      return (
        String(job.id || "").toLowerCase().includes(q) ||
        String(job.original_file_name || "").toLowerCase().includes(q) ||
        String(job.status || "").toLowerCase().includes(q) ||
        String(job.total_value || "").toLowerCase().includes(q)
      );
    });
  }, [jobs, search]);

  const processedCount = summary?.processed_today || 0;
  const successCount = summary?.successful_extractions || 0;
  const pendingCount = summary?.pending_jobs || 0;
  const totalItems = summary?.total_items || 0;

  const failedOrPending = Math.max(processedCount - successCount, pendingCount);

  const successRate = processedCount > 0
    ? Math.round((successCount / processedCount) * 100)
    : 0;

  const totalValue = useMemo(() => {
    return jobs.reduce((sum, job) => {
      const val = Number(String(job.total_value || "").replace(/,/g, ""));
      return sum + (Number.isNaN(val) ? 0 : val);
    }, 0);
  }, [jobs]);

  const avgItemsPerDoc = processedCount > 0
    ? (totalItems / processedCount).toFixed(1)
    : "0";

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_55%)] px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl animate-pulse space-y-6">
          <div className="h-12 w-72 rounded-xl bg-slate-800" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-800" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
            <div className="h-[420px] rounded-3xl bg-slate-800" />
            <div className="h-[420px] rounded-3xl bg-slate-800" />
          </div>
          <div className="h-[420px] rounded-3xl bg-slate-800" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_55%)] px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-900 bg-slate-900 p-8 text-center">
          <h1 className="text-2xl font-bold">Dashboard unavailable</h1>
          <p className="mt-2 text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_55%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge tone="blue">Invoice Parser Dashboard</Badge>
              <Badge tone={successRate >= 80 ? "green" : successRate >= 50 ? "amber" : "red"}>
                Success Rate {successRate}%
              </Badge>
              {summary?.ai_parser_available ? (
                <Badge tone="purple">AI Parser Enabled</Badge>
              ) : (
                <Badge tone="amber">Standard Parser Mode</Badge>
              )}
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Operations Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Monitor document processing, extraction quality, and recent activity.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/upload"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
            >
              Upload New PDF
            </Link>
            <Link
              href="/results"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              View Results
            </Link>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Processed Documents"
            value={processedCount}
            subtext="Total files handled by the system"
            tone="blue"
          />
          <StatCard
            title="Successful Extractions"
            value={successCount}
            subtext="Documents parsed successfully"
            tone="green"
          />
          <StatCard
            title="Total Line Items"
            value={totalItems}
            subtext="Extracted rows across all jobs"
            tone="purple"
          />
          <StatCard
            title="Total Invoice Value"
            value={formatMoney(totalValue)}
            subtext="Combined value from parsed jobs"
            tone="amber"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <SectionCard
              title="Processing Overview"
              subtitle="Core health signals for your parser workflow"
            >
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                  <h3 className="text-base font-semibold text-white">Status Distribution</h3>
                  <MiniBar
                    label="Processed"
                    value={processedCount}
                    total={Math.max(processedCount, 1)}
                    tone="blue"
                  />
                  <MiniBar
                    label="Successful"
                    value={successCount}
                    total={Math.max(processedCount, 1)}
                    tone="green"
                  />
                  <MiniBar
                    label="Pending / Failed"
                    value={failedOrPending}
                    total={Math.max(processedCount, 1)}
                    tone="amber"
                  />
                </div>

                <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                  <h3 className="text-base font-semibold text-white">Useful Metrics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Success Rate
                      </p>
                      <p className="mt-2 text-2xl font-bold text-white">{successRate}%</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Avg Items / Doc
                      </p>
                      <p className="mt-2 text-2xl font-bold text-white">{avgItemsPerDoc}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Excel Exports
                      </p>
                      <p className="mt-2 text-2xl font-bold text-white">
                        {summary?.excel_exports || 0}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Active Queue
                      </p>
                      <p className="mt-2 text-2xl font-bold text-white">{pendingCount}</p>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Recent Documents"
              subtitle="Latest processed and uploaded files"
              rightSlot={
                <input
                  type="text"
                  placeholder="Search files, status, value..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-slate-500 lg:w-72"
                />
              }
            >
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-slate-950">
                    <tr>
                      <th className="border-b border-slate-800 px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                        File
                      </th>
                      <th className="border-b border-slate-800 px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Uploaded
                      </th>
                      <th className="border-b border-slate-800 px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Status
                      </th>
                      <th className="border-b border-slate-800 px-4 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Items
                      </th>
                      <th className="border-b border-slate-800 px-4 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Value
                      </th>
                      <th className="border-b border-slate-800 px-4 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="bg-slate-900">
                    {filteredJobs.length ? (
                      filteredJobs.slice(0, 20).map((job) => {
                        const statusText = String(job.status || "Unknown");
                        const statusTone =
                          statusText.toLowerCase() === "processed"
                            ? "green"
                            : statusText.toLowerCase().includes("pending")
                            ? "amber"
                            : "red";

                        return (
                          <tr
                            key={job.id}
                            className="border-b border-slate-800 transition hover:bg-slate-800/60"
                          >
                            <td className="px-4 py-4 text-slate-200">
                              <div className="max-w-[320px] truncate font-medium">
                                {job.original_file_name || "-"}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                ID: {job.id}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-slate-400">
                              {job.uploaded_at || "-"}
                            </td>
                            <td className="px-4 py-4">
                              <Badge tone={statusTone}>{statusText}</Badge>
                            </td>
                            <td className="px-4 py-4 text-right text-slate-300">
                              {job.total_line_items ?? 0}
                            </td>
                            <td className="px-4 py-4 text-right text-slate-300">
                              {formatMoney(job.total_value)}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <Link
                                href={`/results/${job.id}`}
                                className="inline-flex items-center rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
                              >
                                Open
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-12 text-center text-slate-500"
                        >
                          No documents found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <SectionCard title="Quick Actions" subtitle="Most useful shortcuts">
              <div className="grid grid-cols-1 gap-3">
                <Link
                  href="/upload"
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
                >
                  Upload New Invoice
                </Link>

                <Link
                  href="/results"
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Browse All Results
                </Link>
              </div>
            </SectionCard>

            <SectionCard title="System Snapshot" subtitle="Useful summary only">
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Processed Today</span>
                  <span className="font-semibold text-slate-200">
                    {summary?.processed_today || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Successful</span>
                  <span className="font-semibold text-slate-200">
                    {summary?.successful_extractions || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Pending</span>
                  <span className="font-semibold text-slate-200">
                    {summary?.pending_jobs || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Total Items</span>
                  <span className="font-semibold text-slate-200">
                    {summary?.total_items || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>AI Parser</span>
                  <span className="font-semibold text-slate-200">
                    {summary?.ai_parser_available ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="What was removed" subtitle="Cleaner dashboard choices">
              <ul className="space-y-2 text-sm text-slate-400">
                <li>• Repeated cards showing the same metric</li>
                <li>• Useless decorative charts</li>
                <li>• Empty widgets with no real meaning</li>
                <li>• Duplicate status counts</li>
              </ul>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}