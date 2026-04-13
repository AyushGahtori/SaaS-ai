interface DashboardRouteSkeletonProps {
  title?: string;
  subtitle?: string;
}

export function DashboardRouteSkeleton({
  title = "Loading workspace",
  subtitle = "Preparing your dashboard...",
}: DashboardRouteSkeletonProps) {
  return (
    <div className="h-[calc(100vh-64px)] w-full overflow-hidden px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-56 animate-pulse rounded-lg bg-white/10" />
          <div className="h-4 w-72 animate-pulse rounded bg-white/5" />
          <p className="text-xs text-white/40">{title}</p>
          <p className="text-xs text-white/30">{subtitle}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
          <div className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
          <div className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
        </div>

        <div className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
      </div>
    </div>
  );
}
