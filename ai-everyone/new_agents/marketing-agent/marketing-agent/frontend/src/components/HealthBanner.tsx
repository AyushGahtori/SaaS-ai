"use client";

import { useHealth } from "@/hooks/useHealth";
import { API_BASE } from "@/lib/api";
import {
  Wifi,
  WifiOff,
  Loader2,
  RefreshCw,
  Database,
  Cpu,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import ProviderSwitcher from "@/components/ProviderSwitcher";

interface Props {
  compact?: boolean;
}

export default function HealthBanner({ compact = false }: Props) {
  const { health, isConnected, isChecking, error, recheck } = useHealth();

  if (compact) {
    if (isChecking) {
      return <Loader2 size={12} className="animate-spin text-neutral-500" />;
    }

    if (!isConnected) {
      return (
        <button onClick={recheck} title={error || `Backend offline (${API_BASE})`}>
          <WifiOff size={13} className="text-red-400" />
        </button>
      );
    }

    return (
      <span title="Backend connected">
        <CheckCircle2 size={13} className="text-emerald-400" />
      </span>
    );
  }

  if (isChecking) return null;

  if (!isConnected) {
    return (
      <div className="mx-4 mb-2 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-xs text-red-400">
        <AlertTriangle size={12} className="flex-shrink-0" />
        <span className="flex-1">
          Cannot connect to backend. {error || `Expected the Marketing AI Agent backend at ${API_BASE}.`}
        </span>
        <button
          onClick={recheck}
          className="flex items-center gap-1 hover:text-red-300 transition-colors ml-1"
        >
          <RefreshCw size={11} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-2 flex items-center gap-2 bg-emerald-500/8 border border-emerald-500/15 rounded-xl px-3 py-1.5 text-[11px] text-emerald-400">
      <Wifi size={11} className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <ProviderSwitcher onSwitched={recheck} />
      </div>
      <div className="flex items-center gap-2 ml-2 text-neutral-600">
        <span
          title="Redis"
          className={health?.redis ? "text-emerald-500" : "text-red-500"}
        >
          <Database size={10} />
        </span>
        <span
          title="MongoDB"
          className={health?.mongodb ? "text-emerald-500" : "text-red-500"}
        >
          <Cpu size={10} />
        </span>
      </div>
    </div>
  );
}
