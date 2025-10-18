import type { SystemStatus } from "@/lib/types";

type Props = {
  system: SystemStatus;
};

const metrics = (system: SystemStatus) => [
  {
    label: "Uptime",
    value: system.uptime || "—",
    description: "Since last restart",
  },
  {
    label: "Version",
    value: system.version,
    description: system.reloadRequired ? "Reload required" : "Up to date",
    tone: system.reloadRequired ? "text-amber-500" : "text-emerald-500",
  },
  {
    label: "Active Channels",
    value: system.activeChannels.toString(),
    description: "Real-time channel count",
  },
  {
    label: "Calls Processed",
    value: system.callsProcessed.toString(),
    description: "Since service start",
  },
];

export const StatusCards = ({ system }: Props) => (
  <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {metrics(system).map(({ label, value, description, tone }) => (
      <article
        key={label}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className={`mt-3 text-2xl font-semibold text-slate-900 dark:text-white ${tone ?? ""}`}>
          {value}
        </p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </article>
    ))}
  </section>
);
