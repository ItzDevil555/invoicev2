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
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        ) : null}
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

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-2xl px-4 py-2 text-sm font-semibold transition",
        active
          ? "bg-white text-slate-900"
          : "border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
      )}
    >
      {children}
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();

  const [activeTool, setActiveTool] = useState("extractor");

  // Extractor states
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // M2Gen states
  const [m2File, setM2File] = useState(null);
  const [m2Loading, setM2Loading] = useState(false);
  const [m2Message, setM2Message] = useState("");
  const [m2Error, setM2Error] = useState("");

  const [m2Sheets, setM2Sheets] = useState([]);
  const [invoiceSheet, setInvoiceSheet] = useState("");
  const [detailSheet, setDetailSheet] = useState("");
  const [invoiceInfo, setInvoiceInfo] = useState({});
  const [detailColumns, setDetailColumns] = useState([]);
  const [detailPreviewRows, setDetailPreviewRows] = useState([]);
  const [detailMapping, setDetailMapping] = useState({});
  const [txtOutput, setTxtOutput] = useState("");

  const [shipperName, setShipperName] = useState("");
  const [currencyInput, setCurrencyInput] = useState("USD");
  const [regimeFileType, setRegimeFileType] = useState("Import");
  const [declarationType, setDeclarationType] = useState("Commercial");
  const [paymentMethodType, setPaymentMethodType] = useState("Bank Transfer");
  const [incoType, setIncoType] = useState("EXW");

  const requiredMappingFields = [
    "HS Code",
    "Description",
    "Qty",
    "Net Weight",
    "Value",
    "Country",
  ];

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

  const inspectM2File = async () => {
    if (!m2File) {
      setM2Error("Please choose an Excel file first.");
      return;
    }

    try {
      setM2Loading(true);
      setM2Error("");
      setM2Message("");
      setTxtOutput("");

      const formData = new FormData();
      formData.append("file", m2File);

      const res = await fetch(`${API_BASE}/inspect-special`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || "Inspect failed.");
      }

      setM2Sheets(data.sheet_names || []);
      setInvoiceSheet(data.selected_invoice_sheet || "");
      setDetailSheet(data.selected_detail_sheet || "");
      setInvoiceInfo(data.invoice_info || {});
      setDetailColumns(data.detail_columns || []);
      setDetailPreviewRows(data.detail_preview_rows || []);
      setDetailMapping(data.detail_auto_mapping || {});

      if (!shipperName && data.invoice_info?.shipper) {
        setShipperName(data.invoice_info.shipper);
      }

      setM2Message("Excel inspected successfully.");
    } catch (err) {
      setM2Error(err.message || "Inspect failed.");
    } finally {
      setM2Loading(false);
    }
  };

  const generateM2Txt = async () => {
    if (!m2File) {
      setM2Error("Please choose an Excel file first.");
      return;
    }

    const missing = requiredMappingFields.filter((key) => !detailMapping[key]);
    if (missing.length) {
      setM2Error(`Please map these required fields: ${missing.join(", ")}`);
      return;
    }

    try {
      setM2Loading(true);
      setM2Error("");
      setM2Message("");

      const formData = new FormData();
      formData.append("file", m2File);
      formData.append("invoice_sheet", invoiceSheet || "Invoice-2");
      formData.append("detail_sheet", detailSheet || "HTS_Sum_2");
      formData.append("detail_mapping_json", JSON.stringify(detailMapping));
      formData.append("shipper_override", shipperName);
      formData.append("regime_file_type", regimeFileType);
      formData.append("declaration_type", declarationType);
      formData.append("payment_method_type", paymentMethodType);
      formData.append("currency_override", currencyInput);
      formData.append("inco_term_override", incoType);

      const res = await fetch(`${API_BASE}/generate-special`, {
        method: "POST",
        body: formData,
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || "TXT generation failed.");
      }

      setTxtOutput(text);
      setM2Message("TXT generated successfully.");
    } catch (err) {
      setM2Error(err.message || "TXT generation failed.");
    } finally {
      setM2Loading(false);
    }
  };

  const downloadTxt = () => {
    if (!txtOutput) {
      setM2Error("Generate TXT first.");
      return;
    }

    const blob = new Blob([txtOutput], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trade_output.txt";
    a.click();
    URL.revokeObjectURL(url);
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
              <Badge tone="amber">TXT Generator</Badge>
            </div>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Smart Trade Automation
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400 sm:text-base">
              Upload commercial invoice PDFs for extraction, or upload Excel
              files to inspect, map columns, and generate TXT output.
            </p>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          <TabButton
            active={activeTool === "extractor"}
            onClick={() => setActiveTool("extractor")}
          >
            PDF Extractor
          </TabButton>

          <TabButton
            active={activeTool === "m2gen"}
            onClick={() => setActiveTool("m2gen")}
          >
            TXT Generator
          </TabButton>
        </div>

        {activeTool === "extractor" && (
          <>
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
              <div>
                <div className="mb-6 rounded-3xl border border-indigo-800 bg-gradient-to-r from-indigo-950/60 to-violet-950/60 p-6 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        AI Document Intelligence (Coming Soon)
                      </h3>

                      <p className="mt-2 max-w-2xl text-sm text-slate-300">
                        We are currently integrating advanced AI document parsing
                        to improve accuracy for complex invoices, rotated PDFs,
                        scanned documents, and borderless tables.
                      </p>

                      <p className="mt-2 text-sm text-slate-400">
                        Upcoming features will include smarter table detection,
                        automatic column mapping, and improved data validation.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-indigo-700 bg-indigo-950 px-3 py-1 text-xs font-semibold text-indigo-300">
                        AI Upgrade
                      </span>

                      <span className="rounded-full border border-violet-700 bg-violet-950 px-3 py-1 text-xs font-semibold text-violet-300">
                        Soon
                      </span>
                    </div>
                  </div>
                </div>

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
                          Selected file:{" "}
                          <span className="font-semibold text-white">
                            {file.name}
                          </span>
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
              </div>

              <SectionCard
                title="Quick Notes"
                subtitle="Useful reminders before upload"
              >
                <div className="space-y-4 text-sm text-slate-400">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    Upload only invoice PDFs for the best extraction result.
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    After processing, you will be redirected to the result page
                    automatically.
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    Make sure your FastAPI backend is running on the correct API
                    base URL.
                  </div>
                </div>
              </SectionCard>
            </div>
          </>
        )}

        {activeTool === "m2gen" && (
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Input Format"
                value="Excel"
                subtext=".xlsx / .xls files"
              />
              <StatCard
                title="Output Format"
                value="TXT"
                subtext="Structured declaration text"
              />
              <StatCard
                title="Sheet Logic"
                value="Inspect"
                subtext="Auto-detect sheets and columns"
              />
              <StatCard
                title="Workflow"
                value="TradeTXT"
                subtext="Inspect, map, generate, download"
              />
            </div>

            <div className="grid grid-cols-1 gap-6">
              <SectionCard
                title="TradeTXT Studio"
                subtitle="Upload Excel, inspect sheets, map columns, and generate TXT"
              >
                <div className="space-y-5">
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-6">
                    <label className="mb-3 block text-sm font-semibold text-slate-300">
                      Select Excel file
                    </label>

                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => {
                        const selected = e.target.files?.[0] || null;
                        setM2File(selected);
                        setM2Error("");
                        setM2Message("");
                      }}
                      className="block w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200 file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-900 hover:file:bg-slate-200"
                    />

                    {m2File ? (
                      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
                        Selected file:{" "}
                        <span className="font-semibold text-white">
                          {m2File.name}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={inspectM2File}
                      disabled={m2Loading}
                      className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {m2Loading ? "Working..." : "Inspect Excel"}
                    </button>

                    <button
                      type="button"
                      onClick={generateM2Txt}
                      disabled={m2Loading}
                      className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {m2Loading ? "Generating..." : "Generate TXT"}
                    </button>

                    <button
                      type="button"
                      onClick={downloadTxt}
                      className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                    >
                      Download TXT
                    </button>
                  </div>

                  {m2Message ? (
                    <div className="rounded-2xl border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-300">
                      {m2Message}
                    </div>
                  ) : null}

                  {m2Error ? (
                    <div className="rounded-2xl border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
                      {m2Error}
                    </div>
                  ) : null}
                </div>
              </SectionCard>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <SectionCard
                  title="Sheet Selection"
                  subtitle="Choose the invoice and detail sheets"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300">
                        Invoice Sheet
                      </label>
                      <select
                        value={invoiceSheet}
                        onChange={(e) => setInvoiceSheet(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                      >
                        <option value="">-- Select invoice sheet --</option>
                        {m2Sheets.map((sheet) => (
                          <option key={sheet} value={sheet}>
                            {sheet}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-300">
                        Detail Sheet
                      </label>
                      <select
                        value={detailSheet}
                        onChange={(e) => setDetailSheet(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                      >
                        <option value="">-- Select detail sheet --</option>
                        {m2Sheets.map((sheet) => (
                          <option key={sheet} value={sheet}>
                            {sheet}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Declaration Options"
                  subtitle="Set company and declaration settings"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      value={shipperName}
                      onChange={(e) => setShipperName(e.target.value)}
                      placeholder="Company / Shipper"
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                    />

                    <input
                      value={currencyInput}
                      onChange={(e) => setCurrencyInput(e.target.value)}
                      placeholder="Currency"
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                    />

                    <select
                      value={regimeFileType}
                      onChange={(e) => setRegimeFileType(e.target.value)}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                    >
                      <option>Import</option>
                      <option>Export</option>
                      <option>Transit</option>
                      <option>Re-Export</option>
                      <option>Temporary Import</option>
                      <option>Temporary Export</option>
                    </select>

                    <select
                      value={declarationType}
                      onChange={(e) => setDeclarationType(e.target.value)}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                    >
                      <option>Commercial</option>
                      <option>Sample</option>
                      <option>Return</option>
                      <option>Personal</option>
                      <option>Internal Transfer</option>
                      <option>Free Zone Transfer</option>
                    </select>

                    <select
                      value={paymentMethodType}
                      onChange={(e) => setPaymentMethodType(e.target.value)}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                    >
                      <option>Bank Transfer</option>
                      <option>Cash</option>
                      <option>Credit</option>
                      <option>Letter of Credit</option>
                      <option>Advance Payment</option>
                      <option>Open Account</option>
                    </select>

                    <select
                      value={incoType}
                      onChange={(e) => setIncoType(e.target.value)}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                    >
                      <option>EXW</option>
                      <option>FOB</option>
                      <option>CIF</option>
                      <option>CFR</option>
                      <option>DAP</option>
                      <option>DDP</option>
                      <option>FCA</option>
                    </select>
                  </div>
                </SectionCard>
              </div>

              <SectionCard
                title="Detected Invoice Info"
                subtitle="Auto-detected values from the uploaded workbook"
              >
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="text-sm text-slate-400">Invoice No</div>
                    <div className="mt-1 text-white">
                      {invoiceInfo.invoice_no || "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="text-sm text-slate-400">Invoice Date</div>
                    <div className="mt-1 text-white">
                      {invoiceInfo.invoice_date || "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="text-sm text-slate-400">
                      Detected Shipper
                    </div>
                    <div className="mt-1 text-white">
                      {invoiceInfo.shipper || "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="text-sm text-slate-400">Inco Term</div>
                    <div className="mt-1 text-white">
                      {invoiceInfo.inco_term || "-"}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Column Mapping"
                subtitle="Map your detail sheet columns to the required fields"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  {requiredMappingFields.map((field) => (
                    <div key={field}>
                      <label className="block text-sm font-semibold text-slate-300">
                        {field}
                      </label>
                      <select
                        value={detailMapping[field] || ""}
                        onChange={(e) =>
                          setDetailMapping((prev) => ({
                            ...prev,
                            [field]: e.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                      >
                        <option value="">-- Select column --</option>
                        {detailColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="Detail Preview"
                subtitle="Preview rows from the selected detail sheet"
              >
                {detailPreviewRows.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-800">
                          {Object.keys(detailPreviewRows[0]).map((key) => (
                            <th
                              key={key}
                              className="px-3 py-3 font-semibold text-slate-300"
                            >
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detailPreviewRows.map((row, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-slate-900 align-top"
                          >
                            {Object.keys(detailPreviewRows[0]).map((key) => (
                              <td
                                key={key}
                                className="px-3 py-3 text-slate-400"
                              >
                                {String(row[key] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
                    No preview available yet. Click Inspect Excel first.
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="Generated TXT Output"
                subtitle="Review the generated output before downloading"
              >
                <textarea
                  value={txtOutput}
                  onChange={(e) => setTxtOutput(e.target.value)}
                  className="min-h-[320px] w-full rounded-2xl border border-slate-800 bg-slate-950 p-4 font-mono text-sm text-white outline-none"
                  placeholder="Generated TXT will appear here..."
                />
              </SectionCard>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
