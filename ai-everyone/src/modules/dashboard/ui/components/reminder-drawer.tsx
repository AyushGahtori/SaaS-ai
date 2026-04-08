"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface ReminderItem {
  id: string;
  title: string;
  details: string;
  scheduledFor: string;
  status: string;
  priority: string;
}

interface ReminderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function getHeaders() {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Authentication expired. Please sign in again.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function toInputDateTime(value: string) {
  return value ? value.replace(" ", "T").slice(0, 16) : "";
}

export function ReminderDrawer({ open, onOpenChange }: ReminderDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [priority, setPriority] = useState("normal");

  const loadReminders = useCallback(async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await getHeaders();
      const response = await fetch("/api/bloom-ai/reminders", { headers });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Failed to load reminders.");
      setReminders(Array.isArray(data.reminders) ? data.reminders : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reminders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadReminders();
  }, [open, loadReminders]);

  const upcoming = useMemo(() => reminders.filter((item) => item.status !== "done"), [reminders]);
  const completed = useMemo(() => reminders.filter((item) => item.status === "done"), [reminders]);

  const addReminder = useCallback(async () => {
    if (!title.trim()) {
      setError("Reminder title is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const headers = await getHeaders();
      const response = await fetch("/api/bloom-ai/reminders", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: title.trim(),
          details: details.trim(),
          scheduledFor,
          priority,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Failed to create reminder.");
      setTitle("");
      setDetails("");
      setScheduledFor("");
      setPriority("normal");
      await loadReminders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create reminder.");
    } finally {
      setSaving(false);
    }
  }, [details, loadReminders, priority, scheduledFor, title]);

  const setStatus = useCallback(async (reminderId: string, status: string) => {
    try {
      const headers = await getHeaders();
      const response = await fetch("/api/bloom-ai/reminders", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ reminderId, status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Failed to update reminder.");
      await loadReminders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update reminder.");
    }
  }, [loadReminders]);

  const deleteReminder = useCallback(async (reminderId: string) => {
    try {
      const headers = await getHeaders();
      const response = await fetch("/api/bloom-ai/reminders", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ reminderId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Failed to delete reminder.");
      await loadReminders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete reminder.");
    }
  }, [loadReminders]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] max-w-[95vw] border-white/10 bg-[#0A0A0A] p-0 text-white sm:max-w-[420px]">
        <SheetHeader className="border-b border-white/10 px-5 py-4">
          <SheetTitle className="text-white">Daily Reminders</SheetTitle>
          <SheetDescription className="text-white/45">
            Quick reminder panel with upcoming and completed tasks.
          </SheetDescription>
        </SheetHeader>

        <div className="custom-scrollbar h-[calc(100vh-88px)] space-y-4 overflow-y-auto p-5 pr-3">
          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Add Reminder</p>
            <div className="mt-3 space-y-2">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What should I remind you about?"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
              />
              <textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Add a short detail"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
              />
              <input
                type="datetime-local"
                value={toInputDateTime(scheduledFor)}
                onChange={(event) => setScheduledFor(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
              />
              <div className="flex gap-2">
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
                <button
                  onClick={addReminder}
                  disabled={saving}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
                >
                  {saving ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          </div>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-white/85">Upcoming</h3>
            {loading ? <p className="text-xs text-white/45">Loading...</p> : null}
            {!loading && upcoming.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 px-3 py-3 text-xs text-white/45">No upcoming reminders.</div>
            ) : null}
            {upcoming.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-sm font-medium text-white">{item.title}</p>
                <p className="mt-1 text-xs text-white/45">{item.details || "No extra details"}</p>
                <p className="mt-1 text-xs text-white/45">{item.scheduledFor || "No date set"}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setStatus(item.id, "done")} className="rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 hover:text-white">Done</button>
                  <button onClick={() => deleteReminder(item.id)} className="rounded-md border border-rose-400/20 px-2 py-1 text-xs text-rose-200 hover:text-rose-100">Delete</button>
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-white/85">Completed</h3>
            {completed.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 px-3 py-3 text-xs text-white/45">No completed reminders.</div>
            ) : null}
            {completed.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-sm font-medium text-white/80">{item.title}</p>
                <p className="mt-1 text-xs text-white/45">{item.details || "No extra details"}</p>
                <p className="mt-1 text-xs text-white/45">{item.scheduledFor || "No date set"}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setStatus(item.id, "pending")} className="rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 hover:text-white">Restore</button>
                  <button onClick={() => deleteReminder(item.id)} className="rounded-md border border-rose-400/20 px-2 py-1 text-xs text-rose-200 hover:text-rose-100">Delete</button>
                </div>
              </div>
            ))}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
