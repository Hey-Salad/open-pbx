"use client";

import { useState } from "react";

import { ActiveCallsPanel } from "@/components/active-calls-panel";
import { CallControlPanel } from "@/components/call-control-panel";
import { DashboardHeader } from "@/components/dashboard-header";
import { EventFeed } from "@/components/event-feed";
import { ExtensionsPanel } from "@/components/extensions-panel";
import { StatusCards } from "@/components/status-cards";
import { VoicemailPanel } from "@/components/voicemail-panel";
import { useAsteriskDashboard } from "@/hooks/use-asterisk-dashboard";

const callAction = async (body: unknown) => {
  const response = await fetch("/api/asterisk/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ message: "Action failed" }));
    throw new Error(data.message ?? "Action failed");
  }
};

export default function DashboardPage() {
  const { data, loading, error, refresh, connectionState, lastEvent } =
    useAsteriskDashboard();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleOriginate = async (payload: {
    channel: string;
    exten: string;
    context: string;
    priority?: number;
    callerId?: string;
    timeoutMs?: number;
  }) => {
    await callAction({
      action: "originate",
      payload,
    });
    await refresh();
  };

  const handleTransfer = async (channel: string, exten: string) => {
    await callAction({
      action: "transfer",
      payload: { channel, exten, context: "default", priority: 1 },
    });
    await refresh();
  };

  const handleHangup = async (channel: string) => {
    await callAction({
      action: "hangup",
      payload: { channel },
    });
    await refresh();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 px-4 py-8 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <DashboardHeader
          connectionState={connectionState}
          onRefresh={handleRefresh}
          refreshing={refreshing || loading}
          error={error}
        />

        <StatusCards system={data.system} />

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <ActiveCallsPanel
              calls={data.calls}
              onHangup={handleHangup}
              onTransfer={handleTransfer}
            />
            <ExtensionsPanel extensions={data.extensions} />
          </div>
          <div className="flex flex-col gap-6">
            <CallControlPanel onOriginate={handleOriginate} />
            <VoicemailPanel voicemail={data.voicemail} />
            <EventFeed event={lastEvent} />
          </div>
        </section>
      </main>
    </div>
  );
}
