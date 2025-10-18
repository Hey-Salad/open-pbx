"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

import { DashboardSnapshot } from "@/lib/data-source";
import { ActiveCall, AmiEvent, Extension } from "@/lib/types";

type ConnectionState = "connecting" | "connected" | "offline";

type DashboardProps = {
  initialData: DashboardSnapshot;
};

const formatDuration = (seconds: number): string => {
  const safeSeconds = Math.max(0, seconds);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}m ${secs}s`;
};

const formatRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  if (diff < 5_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "seconds ago";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const fetchDashboardSnapshot = async (): Promise<DashboardSnapshot> => {
  const response = await fetch("/api/asterisk/dashboard", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load dashboard data");
  }

  return response.json();
};

const determineCallStateColor = (state: string): string => {
  const normalized = state.toLowerCase();
  if (normalized.includes("up") || normalized.includes("answered")) {
    return "bg-emerald-100 text-emerald-700";
  }
  if (normalized.includes("ring")) {
    return "bg-amber-100 text-amber-700";
  }
  if (normalized.includes("busy") || normalized.includes("hold")) {
    return "bg-rose-100 text-rose-700";
  }
  return "bg-slate-100 text-slate-700";
};

const determineExtensionStateBadge = (
  state: Extension["state"],
): string => {
  switch (state) {
    case "idle":
      return "bg-emerald-100 text-emerald-700";
    case "ringing":
      return "bg-amber-100 text-amber-700";
    case "busy":
      return "bg-rose-100 text-rose-700";
    case "offline":
      return "bg-slate-200 text-slate-500";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

export function Dashboard({ initialData }: DashboardProps) {
  const [snapshot, setSnapshot] = useState(initialData);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(() => Date.now());
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      setRefreshing(true);
      try {
        const fresh = await fetchDashboardSnapshot();
        if (!cancelled) {
          setSnapshot(fresh);
          setError(null);
          setLastUpdated(Date.now());
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setRefreshing(false);
        }
      }
    };

    refresh();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const connect = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      const eventSource = new EventSource("/api/asterisk/events");
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnectionState("connected");
        setError(null);
      };

      eventSource.onerror = () => {
        setConnectionState("offline");
        setError("Lost connection to AMI event stream");
        eventSource.close();
        retryTimerRef.current = setTimeout(() => {
          setConnectionState("connecting");
          connect();
        }, 5000);
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as AmiEvent;
          setSnapshot((prev) => applyEvent(prev, payload));
          setLastUpdated(Date.now());
        } catch (err) {
          console.error("Failed to parse AMI event", err);
        }
      };
    };

    connect();

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
      eventSourceRef.current?.close();
    };
  }, []);

  const extensionsOnline = useMemo(
    () =>
      snapshot.extensions.filter((extension) => extension.reachable).length,
    [snapshot.extensions],
  );

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const fresh = await fetchDashboardSnapshot();
      setSnapshot(fresh);
      setError(null);
      setLastUpdated(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 pb-16 pt-10">
        <header className="flex flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <Image
                src="/icon.svg"
                width={48}
                height={48}
                alt="Open PBX icon"
                priority
              />
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">
                Open PBX Dashboard
              </h1>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <StatusBadge state={connectionState} />
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span
                className={`h-2 w-2 rounded-full ${refreshing ? "animate-pulse bg-emerald-500" : "bg-rose-500"}`}
                aria-hidden
              />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Uptime"
            value={snapshot.system.uptime}
            helper="Since last restart"
          />
          <StatCard
            title="Version"
            value={snapshot.system.version}
            helper={snapshot.system.reloadRequired ? "Reload required" : "Up to date"}
            helperTone={snapshot.system.reloadRequired ? "warning" : "muted"}
          />
          <StatCard
            title="Active Channels"
            value={snapshot.system.activeChannels.toString()}
            helper="Real-time channel count"
          />
          <StatCard
            title="Calls Processed"
            value={snapshot.system.callsProcessed.toString()}
            helper="Since service start"
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card title="Active Calls" subtitle={`${snapshot.calls.length} active`}>
              {snapshot.calls.length === 0 ? (
                <EmptyState message="No active calls at the moment." />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Channel</th>
                        <th className="px-4 py-3">Caller</th>
                        <th className="px-4 py-3">Callee</th>
                        <th className="px-4 py-3">State</th>
                        <th className="px-4 py-3">Duration</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-sm">
                      {snapshot.calls.map((call) => (
                        <CallRow key={call.uniqueId ?? call.channel} call={call} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <CallControlCard refreshing={refreshing} />
            <Card
              title="Voicemail"
              subtitle={`${snapshot.voicemail.length} mailbox${snapshot.voicemail.length === 1 ? "" : "es"}`}
            >
              <div className="flex flex-col gap-3">
                {snapshot.voicemail.map((mailbox) => (
                  <div
                    key={`${mailbox.context}-${mailbox.mailbox}`}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:border-slate-300"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {mailbox.context.toUpperCase()} • {mailbox.mailbox}
                      </p>
                      <p className="text-xs text-slate-500">
                        {mailbox.newMessages} new / {mailbox.oldMessages} old
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      Voicemail
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>

        <section>
          <Card
            title="Extensions"
            subtitle={`${extensionsOnline} reachable • ${snapshot.extensions.length} total`}
          >
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Extension</th>
                    <th className="px-4 py-3">State</th>
                    <th className="px-4 py-3">Reachable</th>
                    <th className="px-4 py-3">Technology</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-sm">
                  {snapshot.extensions.map((extension) => (
                    <tr key={extension.id} className="hover:bg-slate-50/75">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {extension.id}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${determineExtensionStateBadge(extension.state)}`}
                        >
                          {extension.state.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {extension.reachable ? "Reachable" : "Unavailable"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {extension.technology ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          <div>
            <p>
              Last updated {formatRelativeTime(lastUpdated)}
              {connectionState === "offline" && " • Reconnecting…"}
            </p>
            {error && <p className="text-rose-600">Error: {error}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Image src="/logo.svg" width={120} height={30} alt="Open PBX logo" />
          </div>
        </footer>
      </div>
    </div>
  );
}

type StatCardProps = {
  title: string;
  value: string;
  helper: string;
  helperTone?: "muted" | "warning";
};

const StatCard = ({ title, value, helper, helperTone = "muted" }: StatCardProps) => {
  const helperClass =
    helperTone === "warning"
      ? "text-amber-600"
      : "text-slate-500";

  return (
    <div className="flex flex-col gap-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
        {title}
      </p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className={`text-sm ${helperClass}`}>{helper}</p>
    </div>
  );
};

type CardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

const Card = ({ title, subtitle, children }: CardProps) => (
  <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <header className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {subtitle && <span className="text-sm text-slate-500">{subtitle}</span>}
    </header>
    {children}
  </section>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-slate-500">
    {message}
  </div>
);

const CallRow = ({ call }: { call: ActiveCall }) => {
  const [busy, setBusy] = useState(false);

  const handleAction = async (
    action: "transfer" | "hangup",
    payload: Record<string, unknown>,
  ) => {
    setBusy(true);
    try {
      await fetch("/api/asterisk/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          payload,
        }),
      });
    } catch (error) {
      console.error("Failed to execute AMI action", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="text-slate-700">
      <td className="px-4 py-3 font-medium text-slate-800">{call.channel}</td>
      <td className="px-4 py-3">{call.callerId}</td>
      <td className="px-4 py-3">{call.callee}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${determineCallStateColor(call.state)}`}
        >
          {call.state}
        </span>
      </td>
      <td className="px-4 py-3">{formatDuration(call.duration)}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <button
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy}
            onClick={() =>
              handleAction("transfer", {
                channel: call.channel,
                exten: "1000",
                context: "default",
              })
            }
          >
            Transfer
          </button>
          <button
            className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy}
            onClick={() =>
              handleAction("hangup", {
                channel: call.channel,
              })
            }
          >
            Hangup
          </button>
        </div>
      </td>
    </tr>
  );
};

type CallControlProps = {
  refreshing: boolean;
};

const CallControlCard = ({ refreshing }: CallControlProps) => {
  const [channel, setChannel] = useState("PJSIP/1001");
  const [extension, setExtension] = useState("1000");
  const [context, setContext] = useState("default");
  const [callerId, setCallerId] = useState("Dashboard <1001>");
  const [timeoutMs, setTimeoutMs] = useState(30_000);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const originate = async () => {
    setPending(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/asterisk/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "originate",
          payload: {
            channel,
            exten: extension,
            context,
            callerId,
            timeoutMs,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setFeedback("Call queued successfully.");
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Failed to originate call.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Card title="Call Control" subtitle="Originate outbound calls">
      <div className="flex flex-col gap-3">
        <LabelledInput
          label="Channel"
          value={channel}
          onChange={setChannel}
          placeholder="PJSIP/1001"
        />
        <LabelledInput
          label="Extension"
          value={extension}
          onChange={setExtension}
          placeholder="1000"
        />
        <LabelledInput
          label="Context"
          value={context}
          onChange={setContext}
          placeholder="default"
        />
        <LabelledInput
          label="Caller ID"
          value={callerId}
          onChange={setCallerId}
          placeholder="Dashboard <1001>"
        />
        <LabelledNumberInput
          label="Timeout (ms)"
          value={timeoutMs}
          onChange={setTimeoutMs}
          min={1_000}
        />
        <button
          onClick={originate}
          disabled={pending || refreshing}
          className="mt-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {pending ? "Submitting…" : "Originate Call"}
        </button>
        {feedback && (
          <p className="text-sm text-slate-600">{feedback}</p>
        )}
      </div>
    </Card>
  );
};

const LabelledInput = ({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) => (
  <label className="flex flex-col gap-1 text-sm text-slate-600">
    <span className="font-medium text-slate-700">{label}</span>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="rounded-2xl border border-slate-200 px-3 py-2 text-slate-800 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
    />
  </label>
);

const LabelledNumberInput = ({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
}) => (
  <label className="flex flex-col gap-1 text-sm text-slate-600">
    <span className="font-medium text-slate-700">{label}</span>
    <input
      type="number"
      value={value}
      min={min}
      onChange={(event) => onChange(Number(event.target.value))}
      className="rounded-2xl border border-slate-200 px-3 py-2 text-slate-800 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
    />
  </label>
);

const StatusBadge = ({ state }: { state: ConnectionState }) => {
  const tone =
    state === "connected"
      ? "bg-emerald-100 text-emerald-700"
      : state === "offline"
        ? "bg-rose-100 text-rose-700"
        : "bg-amber-100 text-amber-700";

  const label =
    state === "connected"
      ? "Status: Online"
      : state === "offline"
        ? "Status: Offline"
        : "Status: Connecting";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${tone}`}>
      <span className={`h-2 w-2 rounded-full ${state === "connected" ? "bg-emerald-500" : state === "offline" ? "bg-rose-500" : "bg-amber-500"}`} />
      {label}
    </span>
  );
};

const applyEvent = (
  previous: DashboardSnapshot,
  event: AmiEvent,
): DashboardSnapshot => {
  if (event.type === "call") {
    const existingIndex = event.payload.uniqueId
      ? previous.calls.findIndex((call) => call.uniqueId === event.payload.uniqueId)
      : previous.calls.findIndex((call) => call.channel === event.payload.channel);

    const calls = [...previous.calls];

    if (event.action === "ended") {
      if (existingIndex >= 0) {
        calls.splice(existingIndex, 1);
      }
    } else if (existingIndex >= 0) {
      calls[existingIndex] = event.payload;
    } else {
      calls.unshift(event.payload);
    }

    return { ...previous, calls };
  }

  if (event.type === "extension") {
    const extensions = previous.extensions.map((extension) =>
      extension.id === event.payload.id ? { ...extension, ...event.payload } : extension,
    );

    if (!extensions.some((ext) => ext.id === event.payload.id)) {
      extensions.push(event.payload);
    }

    return { ...previous, extensions };
  }

  if (event.type === "voicemail") {
    const voicemail = previous.voicemail.map((box) =>
      box.mailbox === event.payload.mailbox && box.context === event.payload.context
        ? { ...box, ...event.payload }
        : box,
    );

    if (
      !voicemail.some(
        (box) =>
          box.mailbox === event.payload.mailbox && box.context === event.payload.context,
      )
    ) {
      voicemail.push(event.payload);
    }

    return { ...previous, voicemail };
  }

  if (event.type === "system") {
    return {
      ...previous,
      system: { ...previous.system, ...event.payload },
    };
  }

  return previous;
};
