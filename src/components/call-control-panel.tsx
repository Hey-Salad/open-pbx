"use client";

import { useState, type FormEvent } from "react";

type OriginatePayload = {
  channel: string;
  exten: string;
  context: string;
  priority?: number;
  callerId?: string;
  timeoutMs?: number;
};

type Props = {
  onOriginate: (payload: OriginatePayload) => Promise<void>;
};

const INITIAL_FORM: OriginatePayload = {
  channel: "PJSIP/1001",
  exten: "1000",
  context: "default",
  priority: 1,
  callerId: "Dashboard <1001>",
  timeoutMs: 30000,
};

export const CallControlPanel = ({ onOriginate }: Props) => {
  const [form, setForm] = useState<OriginatePayload>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateField = (key: keyof OriginatePayload, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onOriginate({
        ...form,
        priority: form.priority ? Number(form.priority) : 1,
        timeoutMs: form.timeoutMs ? Number(form.timeoutMs) : 30000,
      });
      setMessage("Originate command sent");
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      const friendly = err instanceof Error ? err.message : "Failed to originate";
      setError(friendly);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Call Control
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Originate outbound calls directly from the PBX.
        </p>
      </header>

      <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
          Channel
          <input
            value={form.channel}
            onChange={(event) => updateField("channel", event.target.value)}
            required
            placeholder="PJSIP/1001"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
          Extension
          <input
            value={form.exten}
            onChange={(event) => updateField("exten", event.target.value)}
            required
            placeholder="1000"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
          Context
          <input
            value={form.context}
            onChange={(event) => updateField("context", event.target.value)}
            required
            placeholder="default"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
          Caller ID
          <input
            value={form.callerId ?? ""}
            onChange={(event) => updateField("callerId", event.target.value)}
            placeholder="Dashboard <1001>"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
          Priority
          <input
            type="number"
            min={1}
            value={form.priority ?? 1}
            onChange={(event) => updateField("priority", event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
          Timeout (ms)
          <input
            type="number"
            min={1000}
            step={1000}
            value={form.timeoutMs ?? 30000}
            onChange={(event) => updateField("timeoutMs", event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {submitting ? "Sending…" : "Originate Call"}
          </button>
        </div>
      </form>

      {message ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">
          {error}
        </p>
      ) : null}
    </section>
  );
};
