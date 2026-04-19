"use client";

export function BloomLoadingScreen() {
    return (
        <div className="flex h-full items-center justify-center bg-[var(--surface-0)] px-6 py-8 text-white">
            <div className="w-full max-w-3xl rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(126,94,255,0.22),transparent_35%),linear-gradient(180deg,#17182b,#0d0f1b)] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
                <div className="skeleton-shimmer h-4 w-40 rounded-full" />
                <div className="mt-6 grid gap-4 lg:grid-cols-[260px_1fr]">
                    <div className="rounded-[24px] border border-white/10 bg-black/30 p-4">
                        <div className="skeleton-shimmer h-10 rounded-2xl" />
                        <div className="mt-3 space-y-3">
                            <div className="skeleton-shimmer h-8 rounded-xl" />
                            <div className="skeleton-shimmer h-8 rounded-xl" />
                            <div className="skeleton-shimmer h-8 rounded-xl" />
                        </div>
                    </div>
                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-6">
                        <div className="skeleton-shimmer h-5 w-44 rounded-full" />
                        <div className="skeleton-shimmer mt-8 h-64 rounded-[28px]" />
                        <div className="skeleton-shimmer mt-6 h-20 rounded-[24px]" />
                    </div>
                </div>
            </div>
        </div>
    );
}
