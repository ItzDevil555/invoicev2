"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://invoicev2-f8bf.onrender.com";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Badge({ children, tone = "default" }) {
  const tones = {
    default: "border-slate-700 bg-slate-800 text-slate-200",
    green: "border-emerald-800 bg-emerald-950/60 text-emerald-300",
    blue: "border-blue-800 bg-blue-950/60 text-blue-300",
    amber: "border-amber-800 bg-amber-950/60 text-amber-300",
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

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 shadow-[0_0_0_1px_rgba(255,255,255,0.01)] backdrop-blur">
      <div className="border-b border-slate-800 px-6 py-5">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function StatCard({ title, value, subtext }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <h3 className="mt-2 text-3xl font-bold text-white">{value}</h3>
      <p className="mt-1 text-sm text-slate-500">{subtext}</p>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file) {
      setError("Please choose a PDF file first.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are allowed.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/upload-pdf/`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || "Upload failed.");
      }

      setMessage("PDF processed successfully.");

      if (data?.id) {
        router.push(`/results/${data.id}`);
      }
    } catch (err) {
      setError(err.message || "Something went wrong while uploading.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_55%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge tone="blue">Invoice Parser</Badge>
              <Badge tone="purple">UAE Customs Workflow</Badge>
              <Badge tone="green">Excel Export Ready</Badge>
            </div>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Smart Invoice Extraction
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400 sm:text-base">
              Upload commercial invoice PDFs, extract line items, company info, totals,
              and export the results directly to Excel.
            </p>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Input Format"
            value="PDF"
            subtext="Commercial invoice documents"
          />
          <StatCard
            title="Output Format"
            value="Excel"
            subtext="Structured export for review"
          />
          <StatCard
            title="Table Support"
            value="Borderless"
            subtext="Handles difficult invoice layouts"
          />
          <StatCard
            title="Workflow"
            value="FastAPI"
            subtext="Connected to your backend parser"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
          <SectionCard
            title="Upload Invoice PDF"
            subtitle="Choose a PDF and send it to your extraction backend"
          >
            <form onSubmit={handleUpload} className="space-y-5">
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-6">
                <label className="mb-3 block text-sm font-semibold text-slate-300">
                  Select PDF file
                </label>

                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    const selected = e.target.files?.[0] || null;
                    setFile(selected);
                    setError("");
                    setMessage("");
                  }}
                  className="block w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200 file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-900 hover:file:bg-slate-200"
                />

                {file ? (
                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
                    Selected file: <span className="font-semibold text-white">{file.name}</span>
                  </div>
                ) : null}
              </div>

              {message ? (
                <div className="rounded-2xl border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-300">
                  {message}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Processing..." : "Upload and Extract"}
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                >
                  Open Dashboard
                </button>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            title="Quick Notes"
            subtitle="Useful reminders before upload"
          >
            <div className="space-y-4 text-sm text-slate-400">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                Upload only invoice PDFs for the best extraction result.
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                After processing, you will be redirected to the result page automatically.
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                AI-based accuracy improvements will be added soon for scanned, rotated, and complex PDFs.
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
