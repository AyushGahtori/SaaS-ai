"use client";

import React, { useMemo } from "react";
import { Building2, IndianRupee, MapPin, Sparkles, Users } from "lucide-react";

interface BuildingConstructionResultCardProps {
    result: Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ""): string {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function formatInr(value: unknown): string {
    const num = asNumber(value);
    if (num === null) return "INR -";
    return `INR ${num.toLocaleString("en-IN")}`;
}

export const BuildingConstructionResultCard: React.FC<BuildingConstructionResultCardProps> = ({ result }) => {
    const payload = useMemo(() => {
        const nested = asObject(result.result);
        return Object.keys(nested).length > 0 ? nested : result;
    }, [result]);

    const structured = asObject(payload.structured_output);
    const plot = asObject(structured.plot_analysis);
    const layout = asObject(structured.layout_plan);
    const cost = asObject(structured.cost_estimate);
    const vendor = asObject(structured.vendor_results);
    const generatedImage = asObject(structured.generated_image);

    const humanResponse = asString(payload.human_response, asString(result.summary, asString(result.message, "Construction plan ready.")));
    const toolsCalled = asArray(structured.tools_called).map((tool) => asString(tool)).filter(Boolean);
    const floorPlans = asArray(layout.floor_plans);
    const vendors = asArray(vendor.vendors);
    const vastuNotes = asArray(layout.vastu_notes).map((note) => asString(note)).filter(Boolean);
    const tips = asArray(cost.cost_saving_tips).map((tip) => asString(tip)).filter(Boolean);
    const imageBase64 = asString(generatedImage.image_base64);
    const imageMime = asString(generatedImage.image_mime_type, "image/jpeg");

    return (
        <div className="mt-3 space-y-3 rounded-3xl border border-white/10 bg-[#0C1118] p-4 text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-4">
                <div className="mb-2 flex items-center gap-2 text-slate-200">
                    <Sparkles className="h-4 w-4" />
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Construction Assistant</p>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{humanResponse}</p>
                {toolsCalled.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {toolsCalled.map((tool) => (
                            <span key={tool} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300">
                                {tool}
                            </span>
                        ))}
                    </div>
                ) : null}
            </div>

            {Object.keys(plot).length > 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-300" />
                        <h4 className="text-sm font-semibold text-slate-100">Plot Analysis</h4>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                            ["Shape", asString(plot.shape)],
                            ["Area", plot.estimated_area_sqm ? `${asString(plot.estimated_area_sqm)} sq m` : ""],
                            ["Width", plot.estimated_width_m ? `${asString(plot.estimated_width_m)} m` : ""],
                            ["Depth", plot.estimated_depth_m ? `${asString(plot.estimated_depth_m)} m` : ""],
                            ["Road Facing", asString(plot.road_facing)],
                            ["Slope", asString(plot.slope)],
                        ]
                            .filter((item) => Boolean(item[1]))
                            .map(([label, value]) => (
                                <div key={label} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{label}</p>
                                    <p className="mt-1 text-sm text-slate-100">{value}</p>
                                </div>
                            ))}
                    </div>
                </div>
            ) : null}

            {Object.keys(layout).length > 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-300" />
                        <h4 className="text-sm font-semibold text-slate-100">Layout Plan</h4>
                    </div>
                    <div className="mb-3 grid gap-2 sm:grid-cols-3">
                        {[
                            ["Floors", asString(layout.floors)],
                            ["Built Area", layout.total_built_area_sqm ? `${asString(layout.total_built_area_sqm)} sq m` : ""],
                            ["Style", asString(layout.design_style)],
                        ]
                            .filter((item) => Boolean(item[1]))
                            .map(([label, value]) => (
                                <div key={label} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{label}</p>
                                    <p className="mt-1 text-sm text-slate-100">{value}</p>
                                </div>
                            ))}
                    </div>
                    {floorPlans.length > 0 ? (
                        <div className="space-y-3">
                            {floorPlans.slice(0, 3).map((floor, idx) => {
                                const floorObj = asObject(floor);
                                const rooms = asArray(floorObj.rooms);
                                return (
                                    <div key={`floor-${idx}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                                        <p className="text-sm font-medium text-slate-100">{idx === 0 ? "Ground Floor" : `Floor ${idx + 1}`}</p>
                                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                            {rooms.slice(0, 6).map((room, rIdx) => {
                                                const roomObj = asObject(room);
                                                return (
                                                    <div key={`room-${idx}-${rIdx}`} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
                                                        <p className="text-xs font-medium text-slate-100">{asString(roomObj.name, "Room")}</p>
                                                        <p className="text-xs text-slate-400">
                                                            {asString(roomObj.area_sqm)} sq m {asString(roomObj.dimensions) ? `• ${asString(roomObj.dimensions)}` : ""}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}
                    {vastuNotes.length > 0 ? (
                        <ul className="mt-3 space-y-1 text-sm text-slate-300">
                            {vastuNotes.slice(0, 5).map((note, idx) => (
                                <li key={`${note}-${idx}`}>{note}</li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            ) : null}

            {Object.keys(cost).length > 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <IndianRupee className="h-4 w-4 text-slate-300" />
                        <h4 className="text-sm font-semibold text-slate-100">Cost Estimate</h4>
                    </div>
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-emerald-100/80">Total</p>
                        <p className="mt-1 text-xl font-semibold text-emerald-100">{formatInr(cost.total_estimated_cost)}</p>
                    </div>
                    {Object.keys(asObject(cost.cost_breakdown)).length > 0 ? (
                        <div className="mt-3 space-y-1">
                            {Object.entries(asObject(cost.cost_breakdown)).map(([key, value]) => (
                                <div key={key} className="flex items-center justify-between border-b border-white/10 py-1.5 text-sm">
                                    <span className="text-slate-300">{key.replace(/_/g, " ")}</span>
                                    <span className="text-slate-100">{formatInr(value)}</span>
                                </div>
                            ))}
                        </div>
                    ) : null}
                    {tips.length > 0 ? (
                        <ul className="mt-3 space-y-1 text-sm text-slate-300">
                            {tips.slice(0, 4).map((tip, idx) => (
                                <li key={`${tip}-${idx}`}>{tip}</li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            ) : null}

            {Object.keys(vendor).length > 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4 text-slate-300" />
                        <h4 className="text-sm font-semibold text-slate-100">Nearby Vendors</h4>
                    </div>
                    {vendors.length === 0 ? (
                        <p className="text-sm text-slate-400">No grounded vendor results were returned.</p>
                    ) : (
                        <div className="space-y-2">
                            {vendors.slice(0, 5).map((item, idx) => {
                                const row = asObject(item);
                                return (
                                    <div key={`vendor-${idx}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                                        <p className="text-sm font-medium text-slate-100">{asString(row.name, "Vendor")}</p>
                                        <p className="text-xs text-slate-400">{asString(row.type, "contractor")}</p>
                                        {asString(row.address) ? <p className="mt-1 text-xs text-slate-300">{asString(row.address)}</p> : null}
                                        {asString(row.phone) ? <p className="text-xs text-slate-300">{asString(row.phone)}</p> : null}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : null}

            {generatedImage.available === true && imageBase64 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <h4 className="mb-2 text-sm font-semibold text-slate-100">Generated Design</h4>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={`data:${imageMime};base64,${imageBase64}`}
                        alt="Generated building design"
                        className="w-full rounded-xl border border-white/10 object-cover"
                    />
                </div>
            ) : null}
        </div>
    );
};
