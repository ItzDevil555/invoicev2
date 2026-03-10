"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

function StatCard({ title, value, subtitle }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/10">
      <div className="text-sm text-slate-400">{title}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{subtitle}</div>
    </div>
  );
}

function DetailCard({ title, children }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <span className="text-slate-500">✦</span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value || "-"}</div>
    </div>
  );
}

export default function ResultPage() {
  const params = useParams();
  const id = params?.id;

  const [data, setData] = useState(null);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        const res = await fetch(`https://invoicev2-f8bf.onrender.com/jobs/${id}`);
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("Failed to load result page data", error);
      }
    };

    load();
  }, [id]);

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-10">
        Loading result...
      </main>
    );
  }

  const stats = [
    {
      title: "Data Sources",
      value: data.data_sources || 1,
      subtitle: "Connected document sources",
    },
    {
      title: "Line Items",
      value: data.total_line_items || 0,
      subtitle: "Merged rows from all extracted tables",
    },
    {
      title: "Weight Matched",
      value: data.weight_matched || 0,
      subtitle: "Rows checked for weight",
    },
    {
      title: "Origin Verified",
      value: data.origin_verified || 0,
      subtitle: "Rows checked for origin",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-[1280px] p-4 md:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-1 rounded-xl bg-cyan-500/10 p-2 text-cyan-300">◈</div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">
                  {data.safe_file_name || data.original_file_name}
                </h1>
                <p className="mt-1 text-sm text-slate-400">{data.uploaded_at}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
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

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <StatCard key={stat.title} {...stat} />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <DetailCard title="Invoice Details">
              <div className="grid gap-6 md:grid-cols-2">
                <Field label="Invoice Number" value={data.invoice_number} />
                <Field label="Invoice Date" value={data.invoice_date} />
                <Field label="Incoterms" value={data.incoterms} />
                <Field label="Total Value" value={data.total_value} />
                <Field label="Total Weight" value={data.total_weight} />
              </div>
            </DetailCard>

            <DetailCard title="Shipping Details">
              <div className="grid gap-6 md:grid-cols-2">
                <Field label="Country of Export" value={data.country_export} />
                <Field label="Country of Import" value={data.country_import} />
                <Field label="Port of Loading" value={data.port_of_loading} />
                <Field label="Port of Discharge" value={data.port_of_discharge} />
                <Field label="Transport Mode" value={data.transport_mode} />
              </div>
            </DetailCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <DetailCard title="Seller / Exporter">
              <div className="grid gap-6 md:grid-cols-2">
                <Field label="Company Name" value={data.company_name} />
                <Field label="Address" value={data.company_address} />
                <Field label="City" value={data.company_city} />
                <Field label="Country" value={data.company_country} />
              </div>
            </DetailCard>

            <DetailCard title="Buyer / Importer">
              <div className="grid gap-6 md:grid-cols-2">
                <Field label="Company Name" value={data.buyer_name} />
                <Field label="Address" value={data.buyer_address} />
                <Field label="City" value={data.buyer_city} />
                <Field label="Country" value={data.buyer_country} />
              </div>
            </DetailCard>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/20">
            <div className="border-b border-white/10 p-5">
              <h2 className="text-xl font-semibold text-white">
                Merged Line Items ({data.total_line_items || 0})
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Combined rows from all extracted tables across the PDF.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <tbody>
                  {data.merged_line_items?.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className={rowIndex === 0 ? "bg-slate-800 text-white" : "border-t border-white/10 text-slate-200"}
                    >
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-4 align-top whitespace-nowrap">
                          {rowIndex === 0 ? (
                            <span className="text-xs font-bold uppercase tracking-wide">{cell}</span>
                          ) : (
                            cell
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
