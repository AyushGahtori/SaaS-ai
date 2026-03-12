"use client";
// Search bar for the agents marketplace — full-width with search icon.

import { Search } from "lucide-react";

interface AgentsSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export const AgentsSearchBar = ({ value, onChange }: AgentsSearchBarProps) => {
  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/30" />
      <input
        id="agents-search"
        type="text"
        placeholder="Search agents..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] py-3.5 pl-12 pr-4 text-sm text-white/90 placeholder-white/25 outline-none backdrop-blur-sm transition-all duration-200 focus:border-white/[0.18] focus:bg-white/[0.05] focus:ring-1 focus:ring-white/[0.08]"
      />
    </div>
  );
};
