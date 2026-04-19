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
        className="ui-surface w-full rounded-2xl border py-3.5 pl-12 pr-4 text-sm text-white/92 placeholder:text-white/28 outline-none transition-[background-color,border-color,box-shadow] focus:border-primary/35 focus:bg-primary/8 focus:shadow-[0_12px_26px_rgb(92_53_229/18%)]"
      />
    </div>
  );
};
