"use client";

import { useEffect, useMemo, useState } from "react";
import { subDays } from "date-fns";
import {
    Area,
    AreaChart,
    CartesianGrid,
    Line,
    LineChart,
    PolarAngleAxis,
    RadialBar,
    RadialBarChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { buildHabitChartData, calculateHabitSuccessRate, formatBloomShortDate, toDateKey } from "@/modules/bloom-ai/lib/shared";
import { BLOOM_HABIT_COLORS } from "@/modules/bloom-ai/constants/defaults";
import type { BloomHabit } from "@/modules/bloom-ai/types";

interface BloomHabitTrackerViewProps {
    habits: BloomHabit[];
    onAddHabit: (input: Pick<BloomHabit, "name" | "category" | "color">) => Promise<BloomHabit>;
    onPatchHabit: (
        input: Partial<Pick<BloomHabit, "name" | "category" | "color" | "completedDates">> & { habitId: string }
    ) => Promise<BloomHabit>;
    onDeleteHabit: (habitId: string) => Promise<void>;
}

export function BloomHabitTrackerView({
    habits,
    onAddHabit,
    onPatchHabit,
    onDeleteHabit,
}: BloomHabitTrackerViewProps) {
    const [selectedHabitId, setSelectedHabitId] = useState<string | null>(habits[0]?.id ?? null);
    const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
    const [name, setName] = useState("");
    const [category, setCategory] = useState("Personal");

    useEffect(() => {
        if (!selectedHabitId && habits[0]) {
            setSelectedHabitId(habits[0].id);
        }
    }, [habits, selectedHabitId]);

    const selectedHabit = habits.find((habit) => habit.id === selectedHabitId) ?? habits[0] ?? null;
    const chartData = useMemo(() => buildHabitChartData(selectedHabit), [selectedHabit]);
    const successRate = useMemo(() => calculateHabitSuccessRate(selectedHabit), [selectedHabit]);
    const recentDays = useMemo(
        () => Array.from({ length: 6 }, (_, index) => subDays(new Date(), 5 - index)),
        []
    );

    const completedOnSelectedDate = selectedHabit?.completedDates.includes(selectedDate) ?? false;

    const toggleSelectedDay = async () => {
        if (!selectedHabit) return;
        const nextDates = completedOnSelectedDate
            ? selectedHabit.completedDates.filter((item) => item !== selectedDate)
            : [...selectedHabit.completedDates, selectedDate];
        const updated = await onPatchHabit({
            habitId: selectedHabit.id,
            completedDates: nextDates.sort(),
        });
        setSelectedHabitId(updated.id);
    };

    return (
        <div className="space-y-5">
            <div className="flex gap-3 overflow-x-auto pb-2">
                {recentDays.map((date) => {
                    const key = toDateKey(date);
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedDate(key)}
                            className={`min-w-[150px] rounded-[24px] border px-5 py-6 text-left ${
                                selectedDate === key
                                    ? "border-[#8FE7B5]/35 bg-black text-white"
                                    : "border-white/10 bg-[#171514] text-white/75"
                            }`}
                        >
                            <p className="text-2xl font-semibold">{date.toLocaleDateString(undefined, { weekday: "long" })}</p>
                            <p className="mt-1 text-xl text-white/72">{formatBloomShortDate(date.toISOString())}</p>
                        </button>
                    );
                })}
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.8fr_1fr]">
                <div className="rounded-[30px] border border-white/10 bg-black p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xl font-semibold text-white">Single Habit Analytics</p>
                            <p className="mt-1 text-sm text-white/45">
                                Track the last month of progress for one habit at a time.
                            </p>
                        </div>
                        <select
                            value={selectedHabit?.id ?? ""}
                            onChange={(event) => setSelectedHabitId(event.target.value)}
                            className="rounded-2xl border border-white/10 bg-[#151515] px-3 py-2 text-sm text-white outline-none"
                        >
                            {habits.length === 0 ? <option value="">Pick a habit</option> : null}
                            {habits.map((habit) => (
                                <option key={habit.id} value={habit.id}>
                                    {habit.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="mt-5 h-[240px] rounded-[24px] border border-white/8 bg-[#0c0c0c] p-3">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="habitArea" x1="0" x2="0" y1="0" y2="1">
                                        <stop offset="5%" stopColor={selectedHabit?.color || "#8FE7B5"} stopOpacity={0.7} />
                                        <stop offset="95%" stopColor={selectedHabit?.color || "#8FE7B5"} stopOpacity={0.08} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                                <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" tick={{ fill: "#aaa", fontSize: 12 }} />
                                <YAxis allowDecimals={false} stroke="rgba(255,255,255,0.4)" tick={{ fill: "#aaa", fontSize: 12 }} />
                                <Tooltip />
                                <Area
                                    dataKey="completions"
                                    stroke={selectedHabit?.color || "#8FE7B5"}
                                    fill="url(#habitArea)"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Button
                            onClick={() => void toggleSelectedDay()}
                            className="rounded-2xl bg-white text-black hover:bg-white/90"
                            disabled={!selectedHabit}
                        >
                            {completedOnSelectedDate ? "Mark Undone" : "Mark Done"}
                        </Button>
                        {selectedHabit ? (
                            <Button
                                variant="ghost"
                                className="rounded-2xl border border-rose-400/18 bg-rose-400/10 text-rose-200 hover:bg-rose-400/18"
                                onClick={() => void onDeleteHabit(selectedHabit.id)}
                            >
                                Delete Habit
                            </Button>
                        ) : null}
                    </div>
                </div>

                <div className="rounded-[30px] border border-white/10 bg-black p-5">
                    <p className="text-xl font-semibold text-white">Single Day Analytics</p>
                    <p className="mt-1 text-sm text-white/45">
                        See whether the selected habit was completed on {selectedDate}.
                    </p>
                    <div className="mt-8 flex justify-center">
                        <ResponsiveContainer width="100%" height={220}>
                            <RadialBarChart
                                data={[{ name: "done", value: completedOnSelectedDate ? 100 : 0, fill: selectedHabit?.color || "#8FE7B5" }]}
                                innerRadius="65%"
                                outerRadius="100%"
                                startAngle={90}
                                endAngle={-270}
                            >
                                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                                <RadialBar background dataKey="value" cornerRadius={20} />
                                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={28} fontWeight={700}>
                                    {completedOnSelectedDate ? "100%" : "0%"}
                                </text>
                                <text x="50%" y="62%" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.45)" fontSize={13}>
                                    Done
                                </text>
                            </RadialBarChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="mt-4 text-center text-sm text-white/55">
                        {selectedHabit ? `${selectedHabit.name} is ${completedOnSelectedDate ? "" : "not "}done for ${selectedDate}.` : "Add a habit to start tracking."}
                    </p>
                </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-black p-5">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-xl font-semibold text-white">Past Month Success</p>
                        <p className="mt-1 text-sm text-white/45">Showing past month analytics</p>
                    </div>
                    <p className="text-sm text-[#8FE7B5]">Average success on the last month is {successRate}%</p>
                </div>
                <div className="mt-4 h-[220px] rounded-[24px] border border-white/8 bg-[#0c0c0c] p-3">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                            <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" tick={{ fill: "#aaa", fontSize: 12 }} />
                            <YAxis allowDecimals={false} stroke="rgba(255,255,255,0.4)" tick={{ fill: "#aaa", fontSize: 12 }} />
                            <Tooltip />
                            <Line
                                type="monotone"
                                dataKey="completions"
                                stroke={selectedHabit?.color || "#8FE7B5"}
                                strokeWidth={2}
                                dot={{ fill: selectedHabit?.color || "#8FE7B5", r: 3 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-[#171514] p-5">
                <div className="flex flex-wrap items-center gap-3">
                    <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Add a habit"
                        className="min-w-[220px] rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                    />
                    <input
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                        placeholder="Category"
                        className="min-w-[180px] rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                    />
                    <div className="flex items-center gap-2">
                        {BLOOM_HABIT_COLORS.map((color) => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => void onAddHabit({ name: name.trim(), category: category.trim() || "General", color })}
                                disabled={!name.trim()}
                                className="size-8 rounded-full border border-white/10 disabled:opacity-40"
                                style={{ backgroundColor: color }}
                                aria-label={`Create habit with ${color}`}
                            />
                        ))}
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                    {habits.map((habit) => (
                        <button
                            key={habit.id}
                            type="button"
                            onClick={() => setSelectedHabitId(habit.id)}
                            className={`rounded-full border px-4 py-2 text-sm ${
                                selectedHabit?.id === habit.id
                                    ? "border-white/25 bg-black text-white"
                                    : "border-white/10 bg-black/30 text-white/65"
                            }`}
                        >
                            {habit.name}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
