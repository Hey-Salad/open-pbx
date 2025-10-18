"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  ActiveCall,
  AmiEvent,
  Extension,
  SystemStatus,
  VoicemailBox,
} from "@/lib/types";

const DEFAULT_SYSTEM: SystemStatus = {
  uptime: "Loading…",
  version: "Asterisk",
  activeChannels: 0,
  callsProcessed: 0,
  reloadRequired: false,
};

const DEFAULT_STATE = {
  system: DEFAULT_SYSTEM,
  calls: [] as ActiveCall[],
  extensions: [] as Extension[],
  voicemail: [] as VoicemailBox[],
};

type DashboardState = typeof DEFAULT_STATE;

type ConnectionState = "connecting" | "open" | "closed";

const apiFetch = async <T>(path: string): Promise<T> => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Request to ${path} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
};

const upsertCall = (calls: ActiveCall[], next: ActiveCall): ActiveCall[] => {
  const index = calls.findIndex((call) => call.channel === next.channel);
  if (index >= 0) {
    const updated = [...calls];
    updated[index] = { ...updated[index], ...next };
    return updated;
  }
  return [...calls, next];
};

const applyEvent = (
  state: DashboardState,
  event: AmiEvent,
): DashboardState => {
  switch (event.type) {
    case "call": {
      if (event.action === "ended") {
        return {
          ...state,
          calls: state.calls.filter((call) => call.uniqueId !== event.payload.uniqueId && call.channel !== event.payload.channel),
        };
      }
      return {
        ...state,
        calls: upsertCall(state.calls, event.payload),
      };
    }
    case "extension": {
      const index = state.extensions.findIndex((ext) => ext.id === event.payload.id);
      if (index >= 0) {
        const updated = [...state.extensions];
        updated[index] = { ...updated[index], ...event.payload };
        return { ...state, extensions: updated };
      }
      return { ...state, extensions: [...state.extensions, event.payload] };
    }
    case "voicemail": {
      const index = state.voicemail.findIndex(
        (box) => box.mailbox === event.payload.mailbox && box.context === event.payload.context,
      );
      if (index >= 0) {
        const updated = [...state.voicemail];
        updated[index] = { ...updated[index], ...event.payload };
        return { ...state, voicemail: updated };
      }
      return { ...state, voicemail: [...state.voicemail, event.payload] };
    }
    case "system": {
      return {
        ...state,
        system: {
          ...DEFAULT_SYSTEM,
          ...state.system,
          ...event.payload,
        },
      };
    }
    case "error": {
      return state;
    }
    default:
      return state;
  }
};

export const useAsteriskDashboard = () => {
  const [state, setState] = useState<DashboardState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [lastEvent, setLastEvent] = useState<AmiEvent | null>(null);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{
        system: SystemStatus;
        calls: ActiveCall[];
        extensions: Extension[];
        voicemail: VoicemailBox[];
      }>("/api/asterisk/status");
      setState({
        system: data.system,
        calls: data.calls,
        extensions: data.extensions,
        voicemail: data.voicemail,
      });
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${protocol}://${window.location.host}/api/asterisk/events`;
    const socket = new WebSocket(url);

    const onOpen = () => setConnectionState("open");
    const onClose = () => setConnectionState("closed");
    const onError = () => setConnectionState("closed");

    const onMessage = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as AmiEvent;
        setState((prev) => applyEvent(prev, parsed));
        setLastEvent(parsed);
      } catch (err) {
        console.error("Failed to parse websocket message", err);
      }
    };

    socket.addEventListener("open", onOpen);
    socket.addEventListener("close", onClose);
    socket.addEventListener("error", onError);
    socket.addEventListener("message", onMessage);

    return () => {
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("close", onClose);
      socket.removeEventListener("error", onError);
      socket.removeEventListener("message", onMessage);
      socket.close();
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      await loadInitial();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    }
  }, [loadInitial]);

  return useMemo(
    () => ({
      data: state,
      loading,
      error,
      refresh,
      connectionState,
      lastEvent,
    }),
    [state, loading, error, refresh, connectionState, lastEvent],
  );
};
