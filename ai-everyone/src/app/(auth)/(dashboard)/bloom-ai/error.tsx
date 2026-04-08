"use client";

import { BloomLoadingScreen } from "@/modules/bloom-ai/ui/components/bloom-loading-screen";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  reset: () => void;
}

const Error = ({ reset }: ErrorProps) => {
  return (
    <div className="relative">
      <BloomLoadingScreen />
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="rounded-[28px] border border-white/10 bg-[#141414]/95 p-8 text-center text-white shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
          <p className="text-2xl font-semibold">Bloom AI hit a problem.</p>
          <p className="mt-2 text-sm text-white/55">
            Reload the workspace and try again.
          </p>
          <Button className="mt-5 rounded-2xl bg-white text-black hover:bg-white/90" onClick={reset}>
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Error;
