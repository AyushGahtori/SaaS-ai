"use client";

export function BloomLoadingScreen() {
    return (
        <div className="flex h-full min-h-[calc(100vh-3rem)] items-center justify-center bg-[#181716] px-6 py-8 text-white">
            <div className="w-full max-w-3xl rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(126,211,171,0.18),transparent_35%),linear-gradient(180deg,#1f1d1c,#111111)] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
                <div className="h-4 w-40 animate-pulse rounded-full bg-white/10" />
                <div className="mt-6 grid gap-4 lg:grid-cols-[260px_1fr]">
                    <div className="rounded-[24px] border border-white/10 bg-black/30 p-4">
                        <div className="h-10 animate-pulse rounded-2xl bg-white/8" />
                        <div className="mt-3 space-y-3">
                            <div className="h-8 animate-pulse rounded-xl bg-white/6" />
                            <div className="h-8 animate-pulse rounded-xl bg-white/6" />
                            <div className="h-8 animate-pulse rounded-xl bg-white/6" />
                        </div>
                    </div>
                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-6">
                        <div className="h-5 w-44 animate-pulse rounded-full bg-white/10" />
                        <div className="mt-8 h-64 animate-pulse rounded-[28px] bg-white/5" />
                        <div className="mt-6 h-20 animate-pulse rounded-[24px] bg-white/8" />
                    </div>
                </div>
            </div>
        </div>
    );
}
