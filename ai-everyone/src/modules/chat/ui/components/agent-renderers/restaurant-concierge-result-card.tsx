"use client";

import React from "react";
import { ChefHat, ClipboardList, Clock3, Hand, ScrollText, ShoppingBag } from "lucide-react";

type UnknownRecord = Record<string, unknown>;

interface RestaurantConciergeResultCardProps {
    result: UnknownRecord;
}

function asRecord(value: unknown): UnknownRecord {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as UnknownRecord)
        : {};
}

function asArray<T = unknown>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown, fallback = "-"): string {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
}

function formatCurrency(value: unknown): string {
    return `INR ${asNumber(value).toFixed(2)}`;
}

function StatChip({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-white/50">{label}</p>
            <p className="mt-1 text-xs font-medium text-white/90">{value}</p>
        </div>
    );
}

function OrderList({ items }: { items: UnknownRecord[] }) {
    if (items.length === 0) {
        return (
            <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/68">
                No active order items yet.
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-white/10 bg-black/25 overflow-hidden">
            <div className="grid grid-cols-[1.5fr_56px_90px] gap-2 border-b border-white/10 px-3 py-2 text-[11px] uppercase tracking-wide text-white/55">
                <span>Item</span>
                <span>Qty</span>
                <span>Total</span>
            </div>
            <div className="max-h-56 overflow-y-auto">
                {items.map((item, idx) => {
                    const customizations = asArray<string>(item.customizations).filter(Boolean);
                    const quantity = asNumber(item.quantity, 1);
                    const unitPrice = asNumber(item.unit_price ?? item.price, 0);
                    const total = asNumber(item.total_price, unitPrice * quantity);
                    return (
                        <div
                            key={`${asString(item.name, "item")}-${idx}`}
                            className="grid grid-cols-[1.5fr_56px_90px] gap-2 border-b border-white/5 px-3 py-2 text-xs text-white/85 last:border-b-0"
                        >
                            <div>
                                <p className="font-medium text-white/92">{asString(item.name, "Item")}</p>
                                {customizations.length > 0 ? (
                                    <p className="mt-1 text-[11px] text-white/58">
                                        {customizations.join(", ")}
                                    </p>
                                ) : null}
                            </div>
                            <span className="text-white/72">{quantity}</span>
                            <span className="text-white/72">{formatCurrency(total)}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function LogList({ logs }: { logs: UnknownRecord[] }) {
    if (logs.length === 0) return null;
    return (
        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
            <p className="mb-2 inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-white/55">
                <ScrollText className="h-3.5 w-3.5" />
                Recent Logs
            </p>
            <div className="space-y-2">
                {logs.slice(0, 4).map((log, idx) => (
                    <div key={`${asString(log.createdAtIso, "log")}-${idx}`} className="rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/55">
                            <span>{asString(log.action, "action").replaceAll("_", " ")}</span>
                            <span>{asString(log.status, "-")}</span>
                        </div>
                        <p className="mt-1 text-xs text-white/72">{asString(log.createdAtIso, "-")}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function RestaurantConciergeResultCard({
    result,
}: RestaurantConciergeResultCardProps) {
    const type = asString(result.type, "restaurant_result");
    const payload = asRecord(result.result);
    const order = asRecord(payload.order);
    const totals = asRecord(order.totals);
    const analytics = asRecord(payload.analytics);
    const session = asRecord(payload.session);
    const state = asRecord(payload.state);
    const item = asRecord(payload.item);
    const logs = asArray<UnknownRecord>(payload.logs);
    const controls = asRecord(payload.controls);
    const responseText =
        asString(payload.responseText, "") ||
        asString(result.message, "") ||
        asString(result.summary, "");
    const summary = asString(result.summary, "");
    const orderItems = asArray<UnknownRecord>(order.items);
    const primaryControls = asArray<string>(controls.primary).filter(Boolean);
    const badgeText =
        type === "restaurant_handoff_result"
            ? "Human Handoff"
            : type === "restaurant_menu_result"
              ? "Menu"
              : type === "restaurant_order_result"
                ? "Order"
                : type === "restaurant_analytics_result"
                  ? "Analytics"
                  : "Conversation";

    return (
        <div className="mt-3 rounded-xl border border-white/10 bg-gradient-to-b from-[#171312] to-[#0f0c0b] p-3">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-white">Restaurant Concierge</p>
                    <p className="text-[11px] uppercase tracking-wide text-white/55">{badgeText}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/12 px-2.5 py-1 text-xs text-amber-100">
                    <ChefHat className="h-3.5 w-3.5" />
                    {asString(result.status, "success")}
                </span>
            </div>

            {summary || responseText ? (
                <div className="mb-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs leading-6 text-white/82">
                    {summary || responseText}
                </div>
            ) : null}

            <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {asString(session.source, "") ? (
                    <StatChip label="Session Source" value={asString(session.source)} />
                ) : null}
                {asString(analytics.session_info && asRecord(analytics.session_info).total_interactions, "") ? (
                    <StatChip
                        label="Interactions"
                        value={asString(asRecord(analytics.session_info).total_interactions)}
                    />
                ) : null}
                {asString(order.status, "") ? (
                    <StatChip label="Order State" value={asString(order.status)} />
                ) : null}
                <StatChip label="Order Total" value={formatCurrency(totals.total)} />
            </div>

            {Object.keys(item).length > 0 ? (
                <div className="mb-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/82">
                    <p className="font-semibold text-white/92">{asString(item.name, "Menu item")}</p>
                    <p className="mt-1">{asString(item.description, "")}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/58">
                        <span>Price: {formatCurrency(item.price)}</span>
                        <span>Category: {asString(item.category, "-")}</span>
                        <span>Prep: {asString(item.prep_time, "-")} min</span>
                    </div>
                </div>
            ) : null}

            <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-3">
                    <div>
                        <p className="mb-2 inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-white/55">
                            <ShoppingBag className="h-3.5 w-3.5" />
                            Current Order
                        </p>
                        <OrderList items={orderItems} />
                    </div>

                    {primaryControls.length > 0 ? (
                        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                            <p className="mb-2 inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-white/55">
                                <ClipboardList className="h-3.5 w-3.5" />
                                Quick Actions
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {primaryControls.map((control) => (
                                    <span
                                        key={control}
                                        className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] text-white/72"
                                    >
                                        {control.replaceAll("_", " ")}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>

                <div className="space-y-3">
                    <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                        <p className="mb-2 inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-white/55">
                            <Clock3 className="h-3.5 w-3.5" />
                            Session State
                        </p>
                        <div className="space-y-1 text-xs text-white/78">
                            <p>Intent: {asString(state.customer_intent, "-")}</p>
                            <p>Stage: {asString(state.conversation_stage, "-")}</p>
                            <p>Last agent: {asString(state.last_agent, "-")}</p>
                            <p>Delivery: {asString(state.delivery_method, "-")}</p>
                        </div>
                    </div>

                    {type === "restaurant_handoff_result" ? (
                        <div className="rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-100">
                            <p className="inline-flex items-center gap-1 font-semibold">
                                <Hand className="h-3.5 w-3.5" />
                                Human follow-up requested
                            </p>
                            <p className="mt-1 text-red-100/80">
                                {asString(payload.handoffReason, "A human teammate has been requested for this session.")}
                            </p>
                        </div>
                    ) : null}

                    <LogList logs={logs} />
                </div>
            </div>
        </div>
    );
}
