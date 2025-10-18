"use client";

import { useState } from "react";

import type { ActiveCall } from "@/lib/types";

type Props = {
  calls: ActiveCall[];
  onHangup: (channel: string) => Promise<void>;
  onTransfer: (channel: string, exten: string) => Promise<void>;
};

export const ActiveCallsPanel = ({ calls, onHangup, onTransfer }: Props) => {
  const [transferTargets, setTransferTargets] = useState<Record<string, string>>({});
  const [busyChannel, setBusyChannel] = useState<string | null>(null);
  const hasCalls = calls.length > 0;

  const handleTransfer = async (channel: string) => {
    const target = transferTargets[channel];
    if (!target) return;
    setBusyChannel(channel);
    try {
      await onTransfer(channel, target);
      setTransferTargets((prev) => ({ ...prev, [channel]: "" }));
    } finally {
      setBusyChannel(null);
    }
  };

  const handleHangup = async (channel: string) => {
    setBusyChannel(channel);
    try {
      await onHangup(channel);
    } finally {
      setBusyChannel(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Active Calls
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time channel activity from the PBX core.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {calls.length} active
        </span>
      </header>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
        <table className="min-w-full table-fixed">
          <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3 text-left">Channel</th>
              <th className="px-4 py-3 text-left">Caller</th>
              <th className="px-4 py-3 text-left">Callee</th>
              <th className="px-4 py-3 text-left">State</th>
              <th className="px-4 py-3 text-left">Duration</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-sm dark:divide-slate-800 dark:bg-slate-900">
            {hasCalls ? (
              calls.map((call) => (
                <tr key={call.uniqueId ?? call.channel} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {call.channel}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {call.callerId}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {call.callee}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {call.state}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {Math.floor(call.duration)}s
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <input
                        value={transferTargets[call.channel] ?? ""}
                        onChange={(event) =>
                          setTransferTargets((prev) => ({
                            ...prev,
                            [call.channel]: event.target.value,
                          }))
                        }
                        placeholder="Extension"
                        className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                      <button
                        onClick={() => void handleTransfer(call.channel)}
                        disabled={!transferTargets[call.channel] || busyChannel === call.channel}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                      >
                        Transfer
                      </button>
                      <button
                        onClick={() => void handleHangup(call.channel)}
                        disabled={busyChannel === call.channel}
                        className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Hang Up
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="px-4 py-12 text-center text-sm italic text-slate-500 dark:text-slate-400"
                  colSpan={6}
                >
                  No active channels.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
