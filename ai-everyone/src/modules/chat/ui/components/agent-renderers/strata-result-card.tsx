"use client";

import { BarChart3, Brain, FileUp, PieChart, TrendingUp } from "lucide-react";
import React, { useMemo, useState } from "react";

type TabKey = "dashboard" | "trends" | "categories" | "insights" | "upload";

interface StrataResultCardProps {
    result: Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown, fallback = 0): number {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

const TAB_BASE =
    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors";

const CATEGORY_COLORS = ["#60a5fa", "#f97316", "#34d399", "#a78bfa", "#22d3ee"];

function formatCompact(value: number): string {
    return value.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function RevenueExpenseBars({ revenue, expenses }: { revenue: number; expenses: number }) {
    const max = Math.max(revenue, expenses, 1);
    const revPct = Math.max(4, Math.round((revenue / max) * 100));
    const expPct = Math.max(4, Math.round((expenses / max) * 100));

    return (
        <div className="space-y-2 rounded-lg border border-white/10 bg-black/30 p-3">
            <p className="text-[11px] uppercase text-white/50">Revenue vs Expenses</p>
            <div>
                <div className="mb-1 flex items-center justify-between text-xs text-white/70">
                    <span>Revenue</span>
                    <span>{formatCompact(revenue)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${revPct}%` }} />
                </div>
            </div>
            <div>
                <div className="mb-1 flex items-center justify-between text-xs text-white/70">
                    <span>Expenses</span>
                    <span>{formatCompact(expenses)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-orange-400" style={{ width: `${expPct}%` }} />
                </div>
            </div>
        </div>
    );
}

function MarginRing({ margin }: { margin: number }) {
    const clamped = Math.max(0, Math.min(100, margin));
    const radius = 32;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (clamped / 100) * circumference;

    return (
        <div className="flex items-center justify-center rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="relative h-20 w-20">
                <svg viewBox="0 0 80 80" className="h-20 w-20">
                    <circle cx="40" cy="40" r={radius} stroke="rgba(255,255,255,0.12)" strokeWidth="8" fill="none" />
                    <circle
                        cx="40"
                        cy="40"
                        r={radius}
                        stroke="#22d3ee"
                        strokeWidth="8"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        transform="rotate(-90 40 40)"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xs text-white/60">Margin</span>
                    <span className="text-sm font-semibold">{clamped.toFixed(2)}%</span>
                </div>
            </div>
        </div>
    );
}

function TrendLineChart({ rows }: { rows: Array<Record<string, unknown>> }) {
    if (rows.length === 0) return null;

    const width = 720;
    const height = 220;
    const padX = 34;
    const padY = 26;

    const revenueValues = rows.map((row) => asNumber(row.revenue));
    const expenseValues = rows.map((row) => asNumber(row.expenses));
    const all = [...revenueValues, ...expenseValues];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const range = Math.max(1, max - min);
    const stepX = rows.length > 1 ? (width - padX * 2) / (rows.length - 1) : width / 2;

    const toPoint = (value: number, i: number) => {
        const x = padX + i * stepX;
        const y = height - padY - ((value - min) / range) * (height - padY * 2);
        return `${x},${y}`;
    };

    const revenuePath = revenueValues.map((value, i) => toPoint(value, i)).join(" ");
    const expensePath = expenseValues.map((value, i) => toPoint(value, i)).join(" ");

    return (
        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="mb-2 flex items-center gap-4 text-xs">
                <span className="inline-flex items-center gap-1 text-cyan-300">
                    <span className="inline-block h-2 w-2 rounded-full bg-cyan-300" /> Revenue
                </span>
                <span className="inline-flex items-center gap-1 text-orange-300">
                    <span className="inline-block h-2 w-2 rounded-full bg-orange-300" /> Expenses
                </span>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
                <svg viewBox={`0 0 ${width} ${height}`} className="h-48 min-w-[680px] w-full">
                    <rect x="0" y="0" width={width} height={height} fill="transparent" />
                    <polyline fill="none" stroke="#22d3ee" strokeWidth="3" points={revenuePath} />
                    <polyline fill="none" stroke="#fb923c" strokeWidth="3" points={expensePath} />
                    {rows.map((row, i) => {
                        const x = padX + i * stepX;
                        const label = String(row.label || `P${i + 1}`);
                        return (
                            <text key={`${label}-${i}`} x={x} y={height - 6} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.55)">
                                {label}
                            </text>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
}

function CategoryDonut({ categories }: { categories: Array<{ label: string; value: number; color: string }> }) {
    const total = Math.max(1, categories.reduce((sum, item) => sum + item.value, 0));
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    let accum = 0;

    return (
        <div className="grid gap-3 rounded-lg border border-white/10 bg-black/30 p-3 sm:grid-cols-[180px_1fr]">
            <div className="flex items-center justify-center">
                <svg viewBox="0 0 140 140" className="h-36 w-36">
                    <g transform="translate(70,70)">
                        {categories.map((cat, index) => {
                            const portion = cat.value / total;
                            const dash = portion * circumference;
                            const gap = circumference - dash;
                            const rotate = (accum / total) * 360 - 90;
                            accum += cat.value;
                            return (
                                <circle
                                    key={`${cat.label}-${index}`}
                                    r={radius}
                                    cx="0"
                                    cy="0"
                                    fill="none"
                                    stroke={cat.color}
                                    strokeWidth="20"
                                    strokeDasharray={`${dash} ${gap}`}
                                    transform={`rotate(${rotate})`}
                                    strokeLinecap="butt"
                                />
                            );
                        })}
                        <circle r="34" fill="#0C0D0D" />
                    </g>
                </svg>
            </div>
            <div className="space-y-2">
                {categories.map((cat, index) => {
                    const pct = (cat.value / total) * 100;
                    return (
                        <div key={`${cat.label}-${index}`} className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-2">
                                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                                    {cat.label}
                                </span>
                                <span>{pct.toFixed(1)}%</span>
                            </div>
                            <div className="mt-1 text-white/70">{formatCompact(cat.value)}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export const StrataResultCard: React.FC<StrataResultCardProps> = ({ result }) => {
    const payload = useMemo(() => {
        const rawResult = asObject(result.result);
        const alreadyWorkspaceShaped =
            Object.prototype.hasOwnProperty.call(rawResult, "dashboard") ||
            Object.prototype.hasOwnProperty.call(rawResult, "trends") ||
            Object.prototype.hasOwnProperty.call(rawResult, "categories") ||
            Object.prototype.hasOwnProperty.call(rawResult, "insights") ||
            Object.prototype.hasOwnProperty.call(rawResult, "upload");

        if (result.type === "strata_workspace" || alreadyWorkspaceShaped) {
            return rawResult;
        }

        return {
            symbol: rawResult.symbol,
            dashboard: result.type === "strata_dashboard" ? rawResult : undefined,
            trends: result.type === "strata_trends" ? rawResult : undefined,
            categories: result.type === "strata_categories" ? rawResult : undefined,
            insights: result.type === "strata_insights" ? rawResult : undefined,
            upload: result.type === "strata_upload" ? rawResult : undefined,
        };
    }, [result]);

    const [activeTab, setActiveTab] = useState<TabKey>(() => {
        if (result.type === "strata_trends") return "trends";
        if (result.type === "strata_categories") return "categories";
        if (result.type === "strata_insights") return "insights";
        if (result.type === "strata_upload") return "upload";
        return "dashboard";
    });

    const symbol = String(payload.symbol || "N/A");
    const dashboard = asObject(payload.dashboard);
    const summary = asObject(dashboard.summary);
    const comparison = asObject(dashboard.comparison);
    const trends = asObject(payload.trends);
    const rawTrendRows = (Array.isArray(trends.trend) ? trends.trend : []).map(asObject);

    const categories = asObject(payload.categories);
    const categoriesMap = asObject(categories.categories);
    const rawCategoriesList = Object.entries(categoriesMap).map(([key, raw], index) => {
        const item = asObject(raw);
        return {
            key,
            label: String(item.label || key).toUpperCase(),
            expenses: asNumber(item.expenses),
            supplierCost: asNumber(item.supplier_cost),
            color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        };
    });

    const insights = asObject(payload.insights);
    const insightData = asObject(Object.prototype.hasOwnProperty.call(insights, "insight") ? insights.insight : insights);
    const upload = asObject(payload.upload);
    const processed = Array.isArray(upload.processedFiles) ? upload.processedFiles : [];
    const failed = Array.isArray(upload.failedFiles) ? upload.failedFiles : [];

    const revenue = asNumber(summary.revenue);
    const expenses = asNumber(summary.expenses);
    const profit = asNumber(summary.profit);
    const margin = asNumber(summary.margin);

    // Fallbacks: older/partial payloads can arrive with only dashboard fields.
    // We derive minimal trend/category series so graph tabs never look empty.
    const trendRows = rawTrendRows.length > 0
        ? rawTrendRows
        : (Object.keys(summary).length > 0
            ? [
                  {
                      label: String(dashboard.periodLabel || "Current"),
                      revenue,
                      expenses,
                      profit,
                      margin,
                  },
              ]
            : []);

    const categoriesList =
        rawCategoriesList.length > 0
            ? rawCategoriesList
            : (Object.keys(summary).length > 0
                ? [
                      {
                          key: "supplier_cost",
                          label: "SUPPLIER COST",
                          expenses: asNumber(summary.supplierCost),
                          supplierCost: asNumber(summary.supplierCost),
                          color: CATEGORY_COLORS[0],
                      },
                      {
                          key: "gross_profit",
                          label: "GROSS PROFIT",
                          expenses: Math.max(0, asNumber(summary.grossProfit)),
                          supplierCost: 0,
                          color: CATEGORY_COLORS[1],
                      },
                  ].filter((row) => row.expenses > 0)
                : []);

    return (
        <div className="mt-3 rounded-xl border border-white/10 bg-[#0C0D0D] p-3 text-white/90">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">Stara Financial Workspace</p>
                <span className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs">{symbol}</span>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
                <button
                    onClick={() => setActiveTab("dashboard")}
                    className={`${TAB_BASE} ${activeTab === "dashboard" ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200" : "border-white/15 bg-white/5 text-white/70"}`}
                >
                    <BarChart3 className="h-3.5 w-3.5" />Dashboard
                </button>
                <button
                    onClick={() => setActiveTab("trends")}
                    className={`${TAB_BASE} ${activeTab === "trends" ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200" : "border-white/15 bg-white/5 text-white/70"}`}
                >
                    <TrendingUp className="h-3.5 w-3.5" />Trends
                </button>
                <button
                    onClick={() => setActiveTab("categories")}
                    className={`${TAB_BASE} ${activeTab === "categories" ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200" : "border-white/15 bg-white/5 text-white/70"}`}
                >
                    <PieChart className="h-3.5 w-3.5" />Categories
                </button>
                <button
                    onClick={() => setActiveTab("insights")}
                    className={`${TAB_BASE} ${activeTab === "insights" ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200" : "border-white/15 bg-white/5 text-white/70"}`}
                >
                    <Brain className="h-3.5 w-3.5" />AI Insights
                </button>
                <button
                    onClick={() => setActiveTab("upload")}
                    className={`${TAB_BASE} ${activeTab === "upload" ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200" : "border-white/15 bg-white/5 text-white/70"}`}
                >
                    <FileUp className="h-3.5 w-3.5" />Upload Report
                </button>
            </div>

            {activeTab === "dashboard" && (
                <div className="space-y-3">
                    {Object.keys(summary).length === 0 ? (
                        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-white/60">
                            No dashboard data is available for this response.
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-2 sm:grid-cols-2">
                                <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                                    <p className="text-[11px] uppercase text-white/50">Revenue</p>
                                    <p className="text-base font-semibold">{formatCompact(revenue)}</p>
                                </div>
                                <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                                    <p className="text-[11px] uppercase text-white/50">Operating Expenses</p>
                                    <p className="text-base font-semibold">{formatCompact(expenses)}</p>
                                </div>
                                <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                                    <p className="text-[11px] uppercase text-white/50">Profit</p>
                                    <p className="text-base font-semibold">{formatCompact(profit)}</p>
                                </div>
                                <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                                    <p className="text-[11px] uppercase text-white/50">Margin</p>
                                    <p className="text-base font-semibold">{margin.toFixed(2)}%</p>
                                </div>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
                                <RevenueExpenseBars revenue={revenue} expenses={expenses} />
                                <MarginRing margin={margin} />
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm text-white/80">
                                Revenue {asNumber(comparison.revenueChangePct).toFixed(2)}% | Expenses {asNumber(comparison.expenseChangePct).toFixed(2)}% | Margin {asNumber(comparison.marginChangePct).toFixed(2)}%
                            </div>
                        </>
                    )}
                </div>
            )}

            {activeTab === "trends" && (
                <div className="space-y-3">
                    {trendRows.length === 0 ? (
                        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-white/60">
                            No trend timeline is available for this response.
                        </div>
                    ) : (
                        <>
                            <TrendLineChart rows={trendRows} />
                            <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                                <p className="mb-2 text-xs uppercase text-white/50">Trend Timeline</p>
                                <div className="custom-scrollbar max-h-48 space-y-1 overflow-y-auto pr-1">
                                    {trendRows.map((row, idx) => (
                                        <div key={`${String(row.label)}-${idx}`} className="grid grid-cols-[1fr_1.3fr_1.3fr_0.8fr] gap-2 rounded-md border border-white/10 px-2 py-1.5 text-xs">
                                            <span className="truncate">{String(row.label || "-")}</span>
                                            <span>{formatCompact(asNumber(row.revenue))}</span>
                                            <span>{formatCompact(asNumber(row.expenses))}</span>
                                            <span>{asNumber(row.margin).toFixed(2)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {activeTab === "categories" && (
                <div className="space-y-3">
                    {categoriesList.length === 0 ? (
                        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-white/60">
                            No category breakdown is available for this response.
                        </div>
                    ) : (
                        <>
                            <CategoryDonut
                                categories={categoriesList.map((item) => ({
                                    label: item.label,
                                    value: item.expenses,
                                    color: item.color,
                                }))}
                            />
                            <div className="grid gap-2">
                                {categoriesList.map((entry) => (
                                    <div key={entry.key} className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-xs">
                                        <p className="font-semibold">{entry.label}</p>
                                        <p className="text-white/75">Expenses: {formatCompact(entry.expenses)}</p>
                                        <p className="text-white/75">Supplier-linked: {formatCompact(entry.supplierCost)}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {activeTab === "insights" && (
                <div className="space-y-2">
                    {Object.keys(insightData).length === 0 ? (
                        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-white/60">
                            No AI insight block is available for this response.
                        </div>
                    ) : (
                        <>
                            <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm">
                                <p className="text-[11px] uppercase text-white/50">What Happened</p>
                                <p>{String(insightData.insight || "-")}</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm">
                                <p className="text-[11px] uppercase text-white/50">Why It Happened</p>
                                <p>{String(insightData.cause || "-")}</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm">
                                <p className="text-[11px] uppercase text-white/50">Recommended Action</p>
                                <p>{String(insightData.action || "-")}</p>
                            </div>
                        </>
                    )}
                </div>
            )}

            {activeTab === "upload" && (
                <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-2.5 text-xs">
                    <p className="text-sm font-medium">{String(upload.reportName || "Uploaded Report")}</p>
                    <p className="text-white/70">Processed: {processed.length} | Failed: {failed.length}</p>
                    {failed.length > 0 && (
                        <ul className="list-disc space-y-1 pl-4 text-red-300">
                            {failed.map((item, idx) => {
                                const row = asObject(item);
                                return (
                                    <li key={`${String(row.name)}-${idx}`}>
                                        {String(row.name)}: {String(row.reason || "Failed")}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    <div className="custom-scrollbar max-h-44 overflow-y-auto whitespace-pre-wrap rounded-md border border-white/10 bg-black/30 p-2 text-white/80">
                        {String(result.summary || "No summary available.")}
                    </div>
                </div>
            )}
        </div>
    );
};
