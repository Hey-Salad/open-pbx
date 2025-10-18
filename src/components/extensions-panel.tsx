import type { Extension } from "@/lib/types";

type Props = {
  extensions: Extension[];
};

const badgeTone = (state: Extension["state"]) => {
  switch (state) {
    case "idle":
      return "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300";
    case "ringing":
      return "bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300";
    case "busy":
      return "bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300";
    case "offline":
      return "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
    default:
      return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  }
};

export const ExtensionsPanel = ({ extensions }: Props) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <header className="mb-4 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Extensions
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Presence state and reachability for registered devices.
        </p>
      </div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {extensions.length} endpoints
      </span>
    </header>

    <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
      <table className="min-w-full table-fixed">
        <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          <tr>
            <th className="px-4 py-3 text-left">Extension</th>
            <th className="px-4 py-3 text-left">State</th>
            <th className="px-4 py-3 text-left">Reachable</th>
            <th className="px-4 py-3 text-left">Technology</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-sm dark:divide-slate-800 dark:bg-slate-900">
          {extensions.length ? (
            extensions.map((extension) => (
              <tr
                key={extension.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">
                  {extension.id}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest ${badgeTone(extension.state)}`}
                  >
                    {extension.state}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-300">
                  {extension.reachable ? "Reachable" : "Unavailable"}
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-300">
                  {extension.technology ?? "—"}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                className="px-4 py-10 text-center text-sm italic text-slate-500 dark:text-slate-400"
                colSpan={4}
              >
                No extensions found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </section>
);
