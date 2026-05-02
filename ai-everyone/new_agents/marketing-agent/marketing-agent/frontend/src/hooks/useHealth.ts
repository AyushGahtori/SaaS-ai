"use client";

import { useState, useEffect, useCallback } from "react";
import { checkHealth } from "@/lib/api";
import type { HealthResponse } from "@/types";

interface UseHealthReturn {
  health: HealthResponse | null;
  isConnected: boolean;
  isChecking: boolean;
  error: string | null;
  recheck: () => void;
}

export function useHealth(pollIntervalMs = 30_000): UseHealthReturn {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recheck = useCallback(async () => {
    setIsChecking(true);
    setError(null);

    try {
      const nextHealth = await checkHealth();
      setHealth(nextHealth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot reach backend");
      setHealth(null);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    recheck();
    const interval = setInterval(recheck, pollIntervalMs);
    return () => clearInterval(interval);
  }, [recheck, pollIntervalMs]);

  return {
    health,
    isConnected: !isChecking && !error && health !== null,
    isChecking,
    error,
    recheck,
  };
}
