"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface ReminderItem {
  id: string;
  title: string;
  datetime: string;
  status: string;
  priority: string;
}

async function getAuthHeaders() {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Authentication expired. Please sign in again.");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function toInputDateTime(value: string) {
  return value ? value.replace(" ", "T").slice(0, 16) : "";
}

function fromInputDateTime(value: string) {
  return value ? value.replace("T", " ") : "";
}

export function ReminderManager() {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [form, setForm] = useState({
    title: "",
    datetime: "",
    priority: "normal",
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => setReady(true));
    return () => unsub();
  }, []);

  const loadReminders = useCallback(async () => {
    if (!auth.currentUser) return;

    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/reminders", {
        method: "GET",
        headers,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to load reminders.");
      }

      setReminders(data.reminders ?? []);
    } catch (err) {
      console.error("[ReminderManager] load error:", err);
      setError(err instanceof Error ? err.message : "Failed to load reminders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready && auth.currentUser) {
      loadReminders();
    }
  }, [loadReminders, ready]);

  const pendingReminders = useMemo(
    () => reminders.filter((reminder) => reminder.status !== "done"),
    [reminders]
  );

  const completedReminders = useMemo(
    () => reminders.filter((reminder) => reminder.status === "done"),
    [reminders]
  );

  const addReminder = async () => {
    if (!form.title.trim()) {
      setError("Reminder title is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/reminders", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: form.title.trim(),
          datetime: fromInputDateTime(form.datetime),
          priority: form.priority,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to add reminder.");
      }

      setForm({ title: "", datetime: "", priority: "normal" });
      await loadReminders();
    } catch (err) {
      console.error("[ReminderManager] create error:", err);
      setError(err instanceof Error ? err.message : "Failed to add reminder.");
    } finally {
      setSaving(false);
    }
  };

  const updateReminderStatus = async (reminderId: string, status: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/reminders", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ reminderId, status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to update reminder.");
      }

      await loadReminders();
    } catch (err) {
      console.error("[ReminderManager] update error:", err);
      setError(err instanceof Error ? err.message : "Failed to update reminder.");
    }
  };

  const deleteReminder = async (reminderId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/reminders?reminderId=${reminderId}`, {
        method: "DELETE",
        headers,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete reminder.");
      }

      await loadReminders();
    } catch (err) {
      console.error("[ReminderManager] delete error:", err);
      setError(err instanceof Error ? err.message : "Failed to delete reminder.");
    }
  };

  if (!ready || loading) {
    return <div className="text-sm text-white/45">Loading reminders...</div>;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-white">Add Reminder</h2>
        <p className="mt-1 text-xs text-white/40">Anything you create here uses the same reminder storage as the to-do agent.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr_0.8fr_auto]">
          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Remind me about..."
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
          />
          <input
            type="datetime-local"
            value={form.datetime}
            onChange={(event) => setForm((prev) => ({ ...prev, datetime: event.target.value }))}
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
          />
          <select
            value={form.priority}
            onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
          <button
            onClick={addReminder}
            disabled={saving}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Adding..." : "Add"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Upcoming</h2>
          <div className="mt-4 space-y-3">
            {pendingReminders.length ? pendingReminders.map((reminder) => (
              <div key={reminder.id} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{reminder.title}</p>
                    <p className="mt-1 text-xs text-white/45">
                      {reminder.datetime || "No date set"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateReminderStatus(reminder.id, "done")}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/65 transition hover:text-white"
                    >
                      Done
                    </button>
                    <button
                      onClick={() => deleteReminder(reminder.id)}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/65 transition hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-sm text-white/45">
                No upcoming reminders.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Completed</h2>
          <div className="mt-4 space-y-3">
            {completedReminders.length ? completedReminders.map((reminder) => (
              <div key={reminder.id} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white/75">{reminder.title}</p>
                    <p className="mt-1 text-xs text-white/40">
                      {reminder.datetime || "No date set"}
                    </p>
                  </div>
                  <button
                    onClick={() => updateReminderStatus(reminder.id, "pending")}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/65 transition hover:text-white"
                  >
                    Restore
                  </button>
                </div>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-sm text-white/45">
                Nothing completed yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
