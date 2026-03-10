"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function StatCard({ title, value, hint }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/10">
      <div className="text-sm text-slate-400">{title}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{hint}</div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [dashboard, setDashboard] = useState({
    processed_today: 0,
    successful_extractions: 0,
    pending_jobs: 0,
    excel_exports: 0,
    recent_uploads: [],
  });

  const loadDashboard = async () => {
    try {
      const res = await fetch("https://invoicev2-f8bf.onrender.com/dashboard-summary");
      const data = await res.json();
      setDashboard(data);
    } catch {
      console.log("Dashboard load failed");
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please choose a PDF file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      setMessage("Processing PDF and building merged line items...");

      const response = await fetch("https://invoicev2-f8bf.onrender.com/upload-pdf/", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Something went wrong.");
        return;
      }

      setMessage("Upload completed successfully.");
      await loadDashboard();

      router.push(`/results/${data.id}`);
    } catch {
      setMessage("Error connecting to backend.");
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    {
      title: "Processed Files",
      value: dashboard.processed_today,
      hint: "All uploaded PDF files",
    },
    {
      title: "Successful Extractions",
      value: dashboard.successful_extractions,
      hint: "Tables exported correctly",
    },
    {
      title: "Pending Jobs",
      value: dashboard.pending_jobs,
      hint: "Currently processing",
    },
    {
      title: "Excel Exports",
      value: dashboard.excel_exports,
      hint: "Generated files",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-white/10 bg-slate-900/90 p-5 backdrop-blur-xl">
          <div className="mb-8">
            <div className="text-xs uppercase tracking-[0.3em] text-blue-300">UAE Customs</div>
            <h1 className="mt-2 text-2xl font-semibold">Automation Dashboard</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Upload a customs PDF, extract tables, and export a clean styled Excel file.
            </p>
          </div>

          <nav className="space-y-2 text-sm">
            {["Dashboard", "Upload PDF", "History", "Exports", "Settings"].map((item, i) => (
              <button
                key={item}
                className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                  i === 0
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-950/40"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="p-4 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-400">Welcome back</p>
              <h2 className="text-3xl font-semibold tracking-tight">Dashboard</h2>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <StatCard key={stat.title} {...stat} />
            ))}
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20">
                <h3 className="text-xl font-semibold">Upload PDF</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Convert invoice and customs documents into a clean multi-sheet Excel file.
                </p>

                <div className="mt-5 rounded-3xl border border-dashed border-blue-500/40 bg-blue-500/5 p-6 text-center">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-2xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-500"
                  />
                  {file && <p className="mt-4 text-sm text-slate-300">Selected file: {file.name}</p>}
                </div>

                <button
                  onClick={handleUpload}
                  disabled={loading}
                  className="mt-5 w-full rounded-2xl bg-blue-600 px-5 py-3 font-medium hover:bg-blue-500 disabled:opacity-50"
                >
                  {loading ? "Processing..." : "Upload and Convert"}
                </button>

                {message && <p className="mt-4 text-center text-sm text-slate-300">{message}</p>}
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20">
                <h3 className="text-xl font-semibold">Recent Uploads</h3>
                <p className="mt-1 text-sm text-slate-400">Live processed files from backend.</p>

                <div className="mt-5 space-y-3">
                  {dashboard.recent_uploads?.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => router.push(`/results/${item.id}`)}
                      className="block w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="font-medium text-white">{item.original_file_name}</div>
                          <div className="mt-1 text-sm text-slate-400">{item.uploaded_at}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                            {item.status}
                          </span>
                          <span className="text-slate-400">Items: {item.total_line_items || 0}</span>
                          <span className="text-slate-400">Value: {item.total_value || "-"}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20">
              <h3 className="text-xl font-semibold">What Happens After Extraction</h3>
              <p className="mt-1 text-sm text-slate-400">
                After a successful upload, the app opens a dedicated result page with extracted company
                info, invoice details, shipping details, and merged line items.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ["Company Info", "Seller and buyer details"],
                  ["Invoice Details", "Invoice number, date, value"],
                  ["Shipping Details", "Origin, import country, transport"],
                  ["Merged Line Items", "All pages combined into one table"],
                  ["Summary", "Line items, qty, value, weights"],
                  ["Export", "Styled Excel with clean sheets"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm text-slate-400">{label}</div>
                    <div className="mt-2 text-base font-semibold text-white">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
