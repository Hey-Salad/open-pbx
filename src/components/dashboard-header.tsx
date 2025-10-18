"use client";

import Image from "next/image";

const CONNECTION_LABELS: Record<string, { text: string; tone: string }> = {
  connecting: { text: "Connecting", tone: "bg-amber-500" },
  open: { text: "Live", tone: "bg-emerald-500" },
  closed: { text: "Offline", tone: "bg-rose-500" },
};

type Props = {
  connectionState: "connecting" | "open" | "closed";
  onRefresh: () => void;
  refreshing: boolean;
  error?: string | null;
};

export const DashboardHeader = ({
  connectionState,
  onRefresh,
  refreshing,
  error,
}: Props) => {
  const connection = CONNECTION_LABELS[connectionState];

  return (
    <header className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 p-2 shadow-inner dark:bg-white">
            <Image
              src="/logo.svg"
              width={36}
              height={36}
              alt="Open PBX"
              priority
            />
          </span>
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Asterisk AMI Control
            </p>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
              Open PBX Dashboard
            </h1>
          </div>
        </div>
        <button
          className="relative inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          onClick={onRefresh}
          disabled={refreshing}
          type="button"
        >
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${connection?.tone ?? "bg-slate-300"}`}
          />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Status: {connection?.text ?? "Unknown"}
        </span>
        <span className="hidden h-1 w-1 rounded-full bg-slate-400 sm:inline-flex" />
        <span>Port 5038</span>
        <span className="hidden h-1 w-1 rounded-full bg-slate-400 sm:inline-flex" />
        <span>Real-time AMI Events</span>
        {error ? (
          <span className="inline-flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
            {error}
          </span>
        ) : null}
      </div>
    </header>
  );
};
