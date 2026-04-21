"use client";

import { useMemo, useState, type FormEvent } from "react";
import { changeCurrentUserPassword } from "@/lib/firebaseAuth";

const MIN_PASSWORD_LENGTH = 8;

interface ChangePasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const INITIAL_FORM_STATE: ChangePasswordFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function validateNewPassword(newPassword: string): string | null {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }

  if (!/[a-z]/.test(newPassword)) {
    return "New password must include at least one lowercase letter.";
  }

  if (!/[A-Z]/.test(newPassword)) {
    return "New password must include at least one uppercase letter.";
  }

  if (!/\d/.test(newPassword)) {
    return "New password must include at least one number.";
  }

  if (!/[^A-Za-z0-9]/.test(newPassword)) {
    return "New password must include at least one symbol.";
  }

  return null;
}

export function ChangePasswordTab() {
  const [form, setForm] = useState<ChangePasswordFormState>(INITIAL_FORM_STATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const checks = useMemo(
    () => [
      { label: "At least 8 characters", pass: form.newPassword.length >= MIN_PASSWORD_LENGTH },
      { label: "One uppercase letter", pass: /[A-Z]/.test(form.newPassword) },
      { label: "One lowercase letter", pass: /[a-z]/.test(form.newPassword) },
      { label: "One number", pass: /\d/.test(form.newPassword) },
      { label: "One symbol", pass: /[^A-Za-z0-9]/.test(form.newPassword) },
      { label: "New password matches confirmation", pass: form.newPassword.length > 0 && form.newPassword === form.confirmPassword },
    ],
    [form.confirmPassword, form.newPassword]
  );

  const updateField = (field: keyof ChangePasswordFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError("Please complete all password fields.");
      return;
    }

    if (form.currentPassword === form.newPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    const validationError = validateNewPassword(form.newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      await changeCurrentUserPassword(form.currentPassword, form.newPassword);
      setForm(INITIAL_FORM_STATE);
      setSuccess("Password updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
      <form onSubmit={handleSubmit} className="ui-surface rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-white">Change Password</h2>
        <p className="mt-1 text-xs text-white/40">
          Confirm your current password before setting a new one. Email-based password reset will be added soon.
        </p>

        <div className="mt-5 space-y-4">
          <label className="block text-sm text-white/75">
            Current password
            <input
              type="password"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={(event) => updateField("currentPassword", event.target.value)}
              className="mt-2 w-full rounded-xl border border-input/90 bg-input/45 px-3 py-2 text-white outline-none hover:border-primary/35 focus-visible:border-primary/55"
            />
          </label>

          <label className="block text-sm text-white/75">
            New password
            <input
              type="password"
              autoComplete="new-password"
              value={form.newPassword}
              onChange={(event) => updateField("newPassword", event.target.value)}
              className="mt-2 w-full rounded-xl border border-input/90 bg-input/45 px-3 py-2 text-white outline-none hover:border-primary/35 focus-visible:border-primary/55"
            />
          </label>

          <label className="block text-sm text-white/75">
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(event) => updateField("confirmPassword", event.target.value)}
              className="mt-2 w-full rounded-xl border border-input/90 bg-input/45 px-3 py-2 text-white outline-none hover:border-primary/35 focus-visible:border-primary/55"
            />
          </label>
        </div>

        {error ? (
          <div className="status-pill-error mt-4 rounded-xl px-4 py-3 text-sm">{error}</div>
        ) : null}

        {success ? (
          <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {success}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_10px_24px_rgb(107_76_255/34%)] transition hover:bg-primary/95 hover:shadow-[0_14px_28px_rgb(107_76_255/40%)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Updating..." : "Update Password"}
        </button>
      </form>

      <div className="ui-surface rounded-2xl p-5">
        <h3 className="text-base font-semibold text-white">Security Checklist</h3>
        <p className="mt-1 text-xs text-white/40">Use a unique password you do not use on other apps.</p>
        <div className="mt-4 space-y-2 text-sm">
          {checks.map((check) => (
            <div
              key={check.label}
              className={`rounded-lg border px-3 py-2 ${check.pass
                ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
                : "border-white/10 bg-black/20 text-white/65"
                }`}
            >
              {check.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
