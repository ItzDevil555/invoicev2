"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

const API_BASE = "https://invoicev2-f8bf.onrender.com";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
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

function SectionCard({ title, subtitle, children, rightSlot, className = "" }) {
  return (
    <div
      className={cx(
        "rounded-3xl border border-slate-800 bg-slate-900/80 shadow-[0_0_0_1px_rgba(255,255,255,0.01)] backdrop-blur",
        className
      )}
    >
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

function StatCard({ title, value, subtext }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <h3 className="mt-2 text-2xl font-bold text-white">{value || "-"}</h3>
      {subtext ? <p className="mt-1 text-sm text-slate-500">{subtext}</p> : null}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-800 py-3 sm:flex-row sm:items-start sm:justify-between">
      <span className="text-sm font-medium text-slate-400">{label}</span>
      <span className="max-w-[65%] break-words text-sm font-semibold text-slate-200">
        {value || "-"}
      </span>
    </div>
  );
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "rounded-2xl px-4 py-2 text-sm font-semibold transition",
        active
          ? "bg-white text-slate-900"
          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
      )}
    >
      {children}
    </button>
  );
}

function ConfidenceMeter({ score }) {
  const tone =
    score >= 80
      ? "from-emerald-400 to-emerald-600"
      : score >= 60
      ? "from-blue-400 to-blue-600"
      : score >= 40
      ? "from-amber-400 to-amber-600"
      : "from-red-400 to-red-600";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-300">Document Confidence</span>
        <span className="text-sm font-bold text-white">{score}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={cx("h-full rounded-full bg-gradient-to-r", tone)}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Based on metadata completeness, item extraction, totals, origin checks, and matched fields.
      </p>
    </div>
  );
}

function getHealthScore(data) {
  let score = 0;
  if ((data?.total_line_items || 0) > 0) score += 25;
  if (data?.invoice_number) score += 10;
  if (data?.invoice_date) score += 10;
  if (data?.company_name) score += 10;
  if (data?.buyer_name) score += 10;
  if ((data?.origin_verified || 0) > 0) score += 15;
  if ((data?.weight_matched || 0) > 0) score += 10;
  if ((data?.data_sources || 0) > 0) score += 10;
  return Math.min(score, 100);
}

function getHealthTone(score) {
  if (score >= 80) return "green";
  if (score >= 60) return "blue";
  if (score >= 40) return "amber";
  return "red";
}

export default function ResultDetailsPage() {
  const params = useParams();
  const id = params?.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tableSearch, setTableSearch] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("items");
  const [exportOpen, setExportOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState([]);

  useEffect(() => {
    if (!id) return;

    const fetchResult = async () => {
      try {
<<<<<<< HEAD
        setLoading(true);
        setError("");

        const res = await fetch(`${API_BASE}/jobs/${id}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to fetch result details");
        }

=======
        const res = await fetch(`https://invoicev2-f8bf.onrender.com/jobs/${id}`);
>>>>>>> 9a1c74a37dcc40296b5b36e87606fc2ff35d64d8
        const json = await res.json();
        setData(json);

        if (Array.isArray(json?.merged_line_items) && json.merged_line_items.length > 0) {
          const header = json.merged_line_items[0] || [];
          setVisibleColumns(header.map((_, idx) => idx));
        }
      } catch (err) {
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [id]);

  const lineItems = useMemo(() => {
    if (!Array.isArray(data?.merged_line_items)) return [];
    return data.merged_line_items;
  }, [data]);

  const fullHeaderRow = useMemo(() => {
    return lineItems.length ? lineItems[0] : [];
  }, [lineItems]);

  const fullBodyRows = useMemo(() => {
    return lineItems.length > 1 ? lineItems.slice(1) : [];
  }, [lineItems]);

  const filteredBodyRows = useMemo(() => {
    if (!tableSearch.trim()) return fullBodyRows;
    const q = tableSearch.toLowerCase();
    return fullBodyRows.filter((row) =>
      row.some((cell) => String(cell).toLowerCase().includes(q))
    );
  }, [fullBodyRows, tableSearch]);

  const displayedHeaderRow = useMemo(() => {
    return fullHeaderRow.filter((_, idx) => visibleColumns.includes(idx));
  }, [fullHeaderRow, visibleColumns]);

  const displayedBodyRows = useMemo(() => {
    return filteredBodyRows.map((row) =>
      row.filter((_, idx) => visibleColumns.includes(idx))
    );
  }, [filteredBodyRows, visibleColumns]);

  const extractionHealth = useMemo(() => getHealthScore(data || {}), [data]);
  const healthTone = getHealthTone(extractionHealth);

  const exportUrl = data?.excel_file ? `${API_BASE}${data.excel_file}` : "#";

  const toggleColumn = (index) => {
    setVisibleColumns((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index].sort((a, b) => a - b)
    );
  };

  const showAllColumns = () => {
    setVisibleColumns(fullHeaderRow.map((_, idx) => idx));
  };

  const hideAllColumns = () => {
    setVisibleColumns([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] px-4 py-10 sm:px-6 lg:px-8">
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
          <div className="h-[520px] rounded-3xl bg-slate-800" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#020617] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-900 bg-slate-900 p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-950 text-red-300">
            !
          </div>
          <h1 className="text-2xl font-bold text-white">Unable to load result</h1>
          <p className="mt-2 text-slate-400">{error || "No data found for this result."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_55%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone="blue">{data.status || "Processed"}</Badge>
              <Badge tone={healthTone}>Extraction Health {extractionHealth}%</Badge>
              {data.ai_parser_available ? (
                <Badge tone="purple">AI Ready</Badge>
              ) : (
                <Badge tone="amber">Standard Parser Only</Badge>
              )}
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Document Intelligence Result
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              File: <span className="font-semibold text-slate-200">{data.file_name || "-"}</span>
            </p>
            <p className="text-sm text-slate-400">
              Uploaded: <span className="font-semibold text-slate-200">{data.uploaded_at || "-"}</span>
            </p>
          </div>

          <div className="relative flex flex-col gap-3 sm:flex-row">
            <a
              href={exportUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
            >
              Download Excel
            </a>

            <div className="relative">
              <button
                onClick={() => setExportOpen((v) => !v)}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
              >
<<<<<<< HEAD
                Export Options
              </button>
=======
                Back to Dashboard
              </Link>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300">
                ✓ {data.status}
              </span>
              <a
                href={`https://invoicev2-f8bf.onrender.com${data.excel_file}`}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Export Excel
              </a>
            </div>
          </div>
>>>>>>> 9a1c74a37dcc40296b5b36e87606fc2ff35d64d8

              {exportOpen && (
                <div className="absolute right-0 z-30 mt-2 w-52 rounded-2xl border border-slate-800 bg-slate-950 p-2 shadow-2xl">
                  <a
                    href={exportUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    Export Excel
                  </a>
                  <button
                    onClick={() => {
                      window.print();
                      setExportOpen(false);
                    }}
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                  >
                    Print Page
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      setExportOpen(false);
                    }}
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                  >
                    Copy Page Link
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Line Items" value={data.total_line_items} subtext="Detected item rows" />
          <StatCard title="Total Quantity" value={data.total_quantity} subtext="Summed from extracted rows" />
          <StatCard title="Total Value" value={data.total_value} subtext="Invoice total or calculated value" />
          <StatCard title="Matched Weights" value={data.weight_matched} subtext="Rows with weight consistency" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <SectionCard
              title="Workspace"
              subtitle="Review extracted data, document details, and parser insights"
              rightSlot={
                <div className="flex flex-wrap gap-2">
                  <TabButton active={activeTab === "items"} onClick={() => setActiveTab("items")}>
                    Items
                  </TabButton>
                  <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
                    Overview
                  </TabButton>
                  <TabButton active={activeTab === "insights"} onClick={() => setActiveTab("insights")}>
                    Insights
                  </TabButton>
                </div>
              }
            >
              {activeTab === "overview" && (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <SectionCard title="Document Overview" subtitle="Core metadata">
                    <InfoRow label="Document Code" value={data.document_code} />
                    <InfoRow label="Invoice Number" value={data.invoice_number} />
                    <InfoRow label="Invoice Date" value={data.invoice_date} />
                    <InfoRow label="Incoterms" value={data.incoterms} />
                    <InfoRow label="Transport Mode" value={data.transport_mode} />
                    <InfoRow label="Port of Loading" value={data.port_of_loading} />
                    <InfoRow label="Port of Discharge" value={data.port_of_discharge} />
                    <InfoRow label="Country of Export" value={data.country_export} />
                    <InfoRow label="Country of Import" value={data.country_import} />
                  </SectionCard>

                  <div className="space-y-6">
                    <SectionCard title="Seller Information" subtitle="Exporter / seller side">
                      <InfoRow label="Company Name" value={data.company_name} />
                      <InfoRow label="Address" value={data.company_address} />
                      <InfoRow label="City" value={data.company_city} />
                      <InfoRow label="Country" value={data.company_country} />
                    </SectionCard>

                    <SectionCard title="Buyer Information" subtitle="Consignee / buyer side">
                      <InfoRow label="Buyer Name" value={data.buyer_name} />
                      <InfoRow label="Address" value={data.buyer_address} />
                      <InfoRow label="City" value={data.buyer_city} />
                      <InfoRow label="Country" value={data.buyer_country} />
                    </SectionCard>
                  </div>
                </div>
              )}

              {activeTab === "insights" && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Origin Verified
                    </p>
                    <p className="mt-2 text-2xl font-bold text-white">{data.origin_verified || 0}</p>
                    <p className="mt-1 text-sm text-slate-500">Rows containing origin or country values</p>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Data Sources
                    </p>
                    <p className="mt-2 text-2xl font-bold text-white">{data.data_sources || 0}</p>
                    <p className="mt-1 text-sm text-slate-500">Sources counted in extracted table</p>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Gross Weight
                    </p>
                    <p className="mt-2 text-2xl font-bold text-white">{data.total_gross_weight || "-"}</p>
                    <p className="mt-1 text-sm text-slate-500">Parsed gross weight total</p>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Net Weight
                    </p>
                    <p className="mt-2 text-2xl font-bold text-white">{data.total_net_weight || "-"}</p>
                    <p className="mt-1 text-sm text-slate-500">Parsed net weight total</p>
                  </div>
                </div>
              )}

              {activeTab === "items" && (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 px-5 py-8 text-center">
                  <p className="text-sm text-slate-400">
                    The full-width line items table is shown below for a cleaner layout.
                  </p>
                </div>
              )}
            </SectionCard>
          </div>

          <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <SectionCard title="Action Center" subtitle="Quick actions and extraction quality">
              <div className="space-y-4">
                <ConfidenceMeter score={extractionHealth} />

                <div className="grid grid-cols-1 gap-3">
                  <a
                    href={exportUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
                  >
                    Export Excel
                  </a>

                  <button
                    onClick={() => setActiveTab("items")}
                    className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                  >
                    Review Line Items
                  </button>

                  <button
                    onClick={() => setActiveTab("overview")}
                    className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                  >
                    Open Document Overview
                  </button>

                  <button
                    onClick={() => setActiveTab("insights")}
                    className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                  >
                    View Extraction Insights
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-sm font-semibold text-slate-300">Parser Status</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone={healthTone}>Health {extractionHealth}%</Badge>
                    <Badge tone="blue">{data.status || "Processed"}</Badge>
                    {data.ai_parser_available ? (
                      <Badge tone="purple">AI Enabled</Badge>
                    ) : (
                      <Badge tone="amber">AI Disabled</Badge>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-sm font-semibold text-slate-300">Quick Summary</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>Invoice Number</span>
                      <span className="font-semibold text-slate-200">{data.invoice_number || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Total Items</span>
                      <span className="font-semibold text-slate-200">{data.total_line_items || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Total Value</span>
                      <span className="font-semibold text-slate-200">{data.total_value || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Buyer</span>
                      <span className="max-w-[140px] truncate font-semibold text-slate-200">
                        {data.buyer_name || "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>

        {activeTab === "items" && (
          <div className="mt-10">
            <SectionCard
              title="Extracted Line Items"
              subtitle="Full-width table view with more space for all columns"
              className="overflow-hidden"
            >
              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <input
                  type="text"
                  placeholder="Search items..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-slate-500 lg:max-w-md"
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={showAllColumns}
                    className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                  >
                    Show All
                  </button>

                  <button
                    onClick={hideAllColumns}
                    className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                  >
                    Hide All
                  </button>
                </div>
              </div>

              {fullHeaderRow.length > 0 && (
                <div className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-3">
                  {fullHeaderRow.map((col, idx) => {
                    const active = visibleColumns.includes(idx);
                    return (
                      <button
                        key={idx}
                        onClick={() => toggleColumn(idx)}
                        className={cx(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          active
                            ? "border-cyan-700 bg-cyan-950/60 text-cyan-300"
                            : "border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800"
                        )}
                      >
                        {String(col || `Column ${idx + 1}`)}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-950">
                    <tr>
                      {displayedHeaderRow.length ? (
                        displayedHeaderRow.map((cell, idx) => (
                          <th
                            key={idx}
                            className="border-b border-slate-800 px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400"
                          >
                            <div className="min-w-[180px]">{String(cell || `Column ${idx + 1}`)}</div>
                          </th>
                        ))
                      ) : (
                        <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                          No visible columns
                        </th>
                      )}
                    </tr>
                  </thead>

                  <tbody className="bg-slate-900">
                    {displayedBodyRows.length ? (
                      displayedBodyRows.map((row, rowIndex) => (
                        <tr
                          key={rowIndex}
                          className="border-b border-slate-800 transition hover:bg-slate-800/60"
                        >
                          {displayedHeaderRow.map((headerCell, cellIndex) => {
                            const value = row[cellIndex];
                            const headerText = String(headerCell || "").toLowerCase();

                            const isNumericColumn =
                              headerText.includes("qty") ||
                              headerText.includes("quantity") ||
                              headerText.includes("amount") ||
                              headerText.includes("value") ||
                              headerText.includes("price") ||
                              headerText.includes("weight") ||
                              headerText.includes("total");

                            return (
                              <td
                                key={cellIndex}
                                className={cx(
                                  "px-4 py-4 align-top text-slate-300",
                                  isNumericColumn ? "text-right" : "text-left"
                                )}
                              >
                                <div className="min-w-[180px] break-words whitespace-pre-wrap leading-6">
                                  {value !== undefined &&
                                  value !== null &&
                                  String(value).trim() !== ""
                                    ? String(value)
                                    : "-"}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={Math.max(displayedHeaderRow.length, 1)}
                          className="px-4 py-12 text-center text-slate-500"
                        >
                          No extracted line items available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
}
