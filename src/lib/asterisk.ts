import { EventEmitter } from "node:events";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

import { getAmiConfig, hasCustomAmiCredentials } from "./config";
import {
  ActiveCall,
  AmiEvent,
  Extension,
  SystemStatus,
  VoicemailBox,
} from "./types";
import {
  mockCalls,
  mockExtensions,
  mockSystemStatus,
  mockVoicemail,
} from "./mock-data";

type AmiMessage = Record<string, string>;

type PendingAction =
  | {
      type: "generic";
      resolve: (message: AmiMessage) => void;
      reject: (error: Error) => void;
    }
  | {
      type: "command";
      buffer: string[];
      resolve: (message: string) => void;
      reject: (error: Error) => void;
    };

type AmiActionPayload = Record<string, string | number | boolean | undefined>;

const parseChunk = (chunk: string): AmiMessage[] => {
  const messages: AmiMessage[] = [];
  const parts = chunk
    .split("\r\n\r\n")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    const lines = part.split(/\r?\n/);
    const message: AmiMessage = {};

    for (const line of lines) {
      const [key, ...rest] = line.split(":");
      if (!key || rest.length === 0) continue;
      message[key.trim()] = rest.join(":").trim();
    }

    if (Object.keys(message).length > 0) {
      messages.push(message);
    }
  }

  return messages;
};

const normalizeDuration = (duration?: string): number => {
  if (!duration) return 0;
  const parsed = Number(duration);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getChannelLabel = (message: AmiMessage): string =>
  message.Channel || message["SIP-Callid"] || "Unknown";

export interface IAsteriskManager {
  ready(): Promise<boolean>;
  sendAction(
    action: string,
    payload?: AmiActionPayload,
  ): Promise<AmiMessage>;
  sendCommand(command: string): Promise<string>;
  getSystemStatus(): Promise<SystemStatus>;
  getActiveCalls(): Promise<ActiveCall[]>;
  getExtensions(): Promise<Extension[]>;
  getVoicemailBoxes(): Promise<VoicemailBox[]>;
  originateCall(args: {
    channel: string;
    exten: string;
    context: string;
    priority?: number;
    callerId?: string;
    timeoutMs?: number;
  }): Promise<void>;
  transferCall(args: {
    channel: string;
    exten: string;
    context: string;
    priority?: number;
  }): Promise<void>;
  hangupCall(channel: string): Promise<void>;
  subscribe(listener: (event: AmiEvent) => void): () => void;
}

class AsteriskManager extends EventEmitter implements IAsteriskManager {
  private socket?: net.Socket;
  private connected = false;
  private buffer = "";
  private connecting?: Promise<void>;
  private readonly pending = new Map<string, PendingAction>();
  private actionCounter = 1;
  private reconnectAttempts = 0;

  constructor(private readonly config = getAmiConfig()) {
    super();
  }

  async ready(): Promise<boolean> {
    try {
      await this.ensureConnected();
      return true;
    } catch (error) {
      console.warn("[AMI] Ready check failed:", error);
      return false;
    }
  }

  subscribe(listener: (event: AmiEvent) => void): () => void {
    this.on("event", listener);
    return () => this.off("event", listener);
  }

  async sendAction(
    action: string,
    payload: AmiActionPayload = {},
  ): Promise<AmiMessage> {
    await this.ensureConnected();
    const actionId = String(this.actionCounter++);

    const commandPayload = Object.entries({
      Action: action,
      ActionID: actionId,
      ...payload,
    })
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\r\n")
      .concat("\r\n\r\n");

    const result = await new Promise<AmiMessage>((resolve, reject) => {
      this.pending.set(actionId, {
        type: "generic",
        resolve: (message) => {
          resolve(message);
        },
        reject,
      });

      this.socket?.write(commandPayload, (err) => {
        if (err) {
          this.pending.delete(actionId);
          reject(err);
        }
      });
    });

    if (result.Response === "Error") {
      throw new Error(result.Message || `AMI action ${action} failed`);
    }

    return result;
  }

  async sendCommand(command: string): Promise<string> {
    await this.ensureConnected();
    const actionId = String(this.actionCounter++);

    const payload = `Action: Command\r\nActionID: ${actionId}\r\nCommand: ${command}\r\n\r\n`;

    return new Promise<string>((resolve, reject) => {
      this.pending.set(actionId, {
        type: "command",
        buffer: [],
        resolve,
        reject,
      });

      this.socket?.write(payload, (err) => {
        if (err) {
          this.pending.delete(actionId);
          reject(err);
        }
      });
    });
  }

  async getSystemStatus(): Promise<SystemStatus> {
    try {
      const [uptimeRaw, versionRaw, statsRaw] = await Promise.all([
        this.sendCommand("core show uptime"),
        this.sendCommand("core show version"),
        this.sendCommand("core show calls"),
      ]);

      const uptimeLine =
        uptimeRaw.split("\n").find((line) => line.includes("System uptime")) ??
        "";
      const versionLine =
        versionRaw.split("\n").find((line) => line.includes("Asterisk")) ?? "";
      const activeLine =
        statsRaw.split("\n").find((line) => line.includes("active call")) ?? "";
      const processedLine =
        statsRaw.split("\n").find((line) => line.includes("calls completed")) ??
        "";

      const activeChannels =
        Number(activeLine.match(/(\d+)/)?.[1] ?? mockSystemStatus.activeChannels);
      const callsProcessed =
        Number(
          processedLine.match(/(\d+)/)?.[1] ?? mockSystemStatus.callsProcessed,
        );

      const reloadRequired = uptimeRaw.includes("AMI");

      return {
        uptime: uptimeLine.replace("System uptime:", "").trim() ||
          mockSystemStatus.uptime,
        version: versionLine.trim() || mockSystemStatus.version,
        activeChannels,
        callsProcessed,
        reloadRequired,
      };
    } catch (error) {
      console.warn("[AMI] Falling back to mock system status:", error);
      return mockSystemStatus;
    }
  }

  async getActiveCalls(): Promise<ActiveCall[]> {
    try {
      const output = await this.sendCommand("core show channels concise");
      const lines = output
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("--"));

      const calls: ActiveCall[] = lines.map((line) => {
        const [
          channel,
          context,
          extension,
          priority,
          state,
          application,
          data,
          callerIdName,
          callerIdNum,
          duration,
        ] = line.split("!");

        return {
          channel: channel || "Unknown",
          callee: `${context}/${extension || "unknown"}`,
          state: state || "Unknown",
          callerId: callerIdName
            ? `${callerIdName} <${callerIdNum || "unknown"}>`
            : callerIdNum || "Unknown",
          duration: normalizeDuration(duration),
          uniqueId: `${channel}-${priority}-${application}`,
        };
      });

      return calls.length > 0 ? calls : mockCalls;
    } catch (error) {
      console.warn("[AMI] Falling back to mock active calls:", error);
      return mockCalls;
    }
  }

  async getExtensions(): Promise<Extension[]> {
    try {
      const output = await this.sendCommand("pjsip show endpoints");
      const results: Extension[] = [];

      let current: Extension | null = null;
      for (const line of output.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const endpointMatch = trimmed.match(/^Endpoint:\s+(.+)$/);
        if (endpointMatch) {
          if (current) results.push(current);
          const id = endpointMatch[1].trim();
          current = {
            id,
            state: "unknown",
            reachable: false,
            technology: "PJSIP",
          };
          continue;
        }

        if (!current) continue;

        if (trimmed.startsWith("Contacts:")) {
          current.reachable = !trimmed.includes("Unreachable")
            && !trimmed.includes("Avail:Unknown");
        }

        if (trimmed.startsWith("Status:")) {
          const statusText = trimmed.replace("Status:", "").trim().toLowerCase();
          if (statusText.includes("available")) current.state = "idle";
          else if (statusText.includes("busy")) current.state = "busy";
          else if (statusText.includes("ringing")) current.state = "ringing";
          else if (statusText.includes("unreachable")) current.state = "offline";
          else current.state = "unknown";
        }
      }

      if (current) results.push(current);
      return results.length > 0 ? results : mockExtensions;
    } catch (error) {
      console.warn("[AMI] Falling back to mock extensions:", error);
      return mockExtensions;
    }
  }

  async getVoicemailBoxes(): Promise<VoicemailBox[]> {
    try {
      const output = await this.sendCommand("voicemail show users");
      const lines = output.split("\n");
      const entries: VoicemailBox[] = [];

      for (const line of lines) {
        const clean = line.trim();
        if (!clean || clean.startsWith("Context")) continue;

        const parts = clean.split(/\s+/);
        if (parts.length >= 5) {
          const [context, mailbox, _, newMessages, oldMessages] = parts;
          entries.push({
            context,
            mailbox,
            newMessages: Number(newMessages),
            oldMessages: Number(oldMessages),
          });
        }
      }

      return entries.length > 0 ? entries : mockVoicemail;
    } catch (error) {
      console.warn("[AMI] Falling back to mock voicemail:", error);
      return mockVoicemail;
    }
  }

  async originateCall({
    channel,
    exten,
    context,
    priority = 1,
    callerId,
    timeoutMs = 30000,
  }: {
    channel: string;
    exten: string;
    context: string;
    priority?: number;
    callerId?: string;
    timeoutMs?: number;
  }): Promise<void> {
    await this.sendAction("Originate", {
      Channel: channel,
      Exten: exten,
      Context: context,
      Priority: priority,
      CallerID: callerId,
      Timeout: timeoutMs,
    });
  }

  async transferCall({
    channel,
    exten,
    context,
    priority = 1,
  }: {
    channel: string;
    exten: string;
    context: string;
    priority?: number;
  }): Promise<void> {
    await this.sendAction("Redirect", {
      Channel: channel,
      Exten: exten,
      Context: context,
      Priority: priority,
    });
  }

  async hangupCall(channel: string): Promise<void> {
    await this.sendAction("Hangup", {
      Channel: channel,
    });
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected && this.socket) {
      return;
    }

    if (this.connecting) {
      return this.connecting;
    }

    this.connecting = this.establishConnection();
    return this.connecting.finally(() => {
      this.connecting = undefined;
    });
  }

  private async establishConnection(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const socket = net.createConnection(
        {
          host: this.config.host,
          port: this.config.port,
        },
        () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.socket = socket;
          this.login()
            .then(resolve)
            .catch((error) => {
              reject(error);
              this.handleDisconnect();
            });
        },
      );

      socket.on("data", (data) => {
        this.buffer += data.toString();
        const messages = parseChunk(this.buffer);

        const lastChunkEndsWithSeparator = this.buffer.endsWith("\r\n\r\n");
        if (lastChunkEndsWithSeparator) {
          this.buffer = "";
        } else {
          const lastSeparatorIndex = this.buffer.lastIndexOf("\r\n\r\n");
          if (lastSeparatorIndex >= 0) {
            this.buffer = this.buffer.slice(lastSeparatorIndex + 4);
          }
        }

        for (const message of messages) {
          this.processMessage(message);
        }
      });

      socket.on("error", (error) => {
        if (!this.connected) {
          reject(error);
        } else {
          console.error("[AMI] Socket error:", error);
        }
        this.handleDisconnect();
      });

      socket.on("end", () => {
        console.warn("[AMI] Connection ended.");
        this.handleDisconnect();
      });

      socket.on("close", () => {
        console.warn("[AMI] Connection closed.");
        this.handleDisconnect();
      });
    });
  }

  private async login(): Promise<void> {
    const response = await this.sendRawLogin();
    if (response.Response !== "Success") {
      throw new Error(response.Message || "AMI login failed");
    }
  }

  private sendRawLogin(): Promise<AmiMessage> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("AMI socket not available for login"));
        return;
      }

      const actionId = String(this.actionCounter++);
      const payload = [
        "Action: Login",
        `ActionID: ${actionId}`,
        `Username: ${this.config.username}`,
        `Secret: ${this.config.password}`,
        `Events: ${this.config.events ?? "on"}`,
        "",
      ].join("\r\n");

      this.pending.set(actionId, {
        type: "generic",
        resolve,
        reject,
      });

      this.socket.write(`${payload}\r\n`, (err) => {
        if (err) {
          this.pending.delete(actionId);
          reject(err);
        }
      });
    });
  }

  private processMessage(message: AmiMessage): void {
    if (message.Response) {
      const actionId = message.ActionID;
      if (actionId && this.pending.has(actionId)) {
        const pending = this.pending.get(actionId);
        if (pending?.type === "generic") {
          this.pending.delete(actionId);
          pending.resolve(message);
        }
        return;
      }
    }

    if (message.Event) {
      this.handleEvent(message);
      const actionId = message.ActionID;
      if (actionId && this.pending.has(actionId)) {
        const pending = this.pending.get(actionId);
        if (pending?.type === "command") {
          if (message.Event === "CommandOutput") {
            pending.buffer.push(message.Output ?? "");
            return;
          }

          if (message.Event === "CommandComplete") {
            this.pending.delete(actionId);
            pending.resolve(pending.buffer.join("\n"));
            return;
          }
        }
      }
    }
  }

  private handleEvent(message: AmiMessage): void {
    const eventName = message.Event;
    if (!eventName) return;

    if (eventName === "FullyBooted") {
      this.emit("event", {
        type: "system",
        payload: { uptime: "Asterisk manager connected" },
      });
      return;
    }

    if (eventName === "Hangup" || eventName === "Newchannel" || eventName === "Dial") {
      const payload: ActiveCall = {
        channel: getChannelLabel(message),
        callerId: message.CallerIDNum
          ? `${message.CallerIDName ?? "Unknown"} <${message.CallerIDNum}>`
          : message.CallerIDName || "Unknown",
        callee: message.ConnectedLineNum
          ? `${message.ConnectedLineName ?? "Unknown"} <${message.ConnectedLineNum}>`
          : message.Exten || "Unknown",
        state: message.ChannelStateDesc || eventName,
        duration: normalizeDuration(message.Duration),
        uniqueId: message.Uniqueid,
      };

      this.emit("event", {
        type: "call",
        payload,
        action: eventName === "Hangup" ? "ended" : "updated",
      });
      return;
    }

    if (eventName.includes("ExtensionStatus")) {
      const statusDesc = message.StatusText?.toLowerCase() ?? "";
      let state: Extension["state"] = "unknown";
      if (statusDesc.includes("idle")) state = "idle";
      else if (statusDesc.includes("ringing")) state = "ringing";
      else if (statusDesc.includes("busy")) state = "busy";
      else if (statusDesc.includes("unavailable") || statusDesc.includes("unregistered"))
        state = "offline";

      const extensionPayload: Extension = {
        id: message.Exten ?? "unknown",
        state,
        reachable: !statusDesc.includes("unavailable") && !statusDesc.includes("unregistered"),
      };

      this.emit("event", {
        type: "extension",
        payload: extensionPayload,
      });
      return;
    }

    if (eventName === "NewVoicemail" || eventName === "MailboxStatus") {
      const voicemailPayload: VoicemailBox = {
        mailbox: message.Mailbox ?? "unknown",
        context: message.Context ?? "default",
        newMessages: Number(message.NewMessages ?? 0),
        oldMessages: Number(message.OldMessages ?? 0),
      };

      this.emit("event", {
        type: "voicemail",
        payload: voicemailPayload,
      });
      return;
    }
  }

  private handleDisconnect(): void {
    this.connected = false;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = undefined;
    }

    for (const [actionId, pending] of this.pending) {
      pending.reject(new Error("AMI connection lost"));
      this.pending.delete(actionId);
    }

    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    const attempt = this.reconnectAttempts++;
    const backoff = Math.min(1000 * 2 ** attempt, 30_000);

    delay(backoff)
      .then(() => this.ensureConnected())
      .catch((error) => {
        console.error("[AMI] Reconnect attempt failed:", error);
        this.scheduleReconnect();
      });
  }
}

class MockAsteriskManager extends EventEmitter implements IAsteriskManager {
  private mockCalls = mockCalls;

  constructor() {
    super();
    this.bootstrapMockEvents();
  }

  private bootstrapMockEvents() {
    const timer = setInterval(() => {
      this.mockCalls = this.mockCalls.map((call) => ({
        ...call,
        duration: call.duration + 5,
      }));
      const call = this.mockCalls[Math.floor(Math.random() * this.mockCalls.length)];
      this.emit("event", {
        type: "call",
        payload: call,
        action: "updated",
      });
    }, 5000);

    if (typeof timer === "object" && "unref" in (timer as NodeJS.Timeout)) {
      (timer as NodeJS.Timeout).unref();
    }
  }

  async ready(): Promise<boolean> {
    return true;
  }

  subscribe(listener: (event: AmiEvent) => void): () => void {
    this.on("event", listener);
    return () => this.off("event", listener);
  }

  async sendAction(): Promise<AmiMessage> {
    return { Response: "Success" };
  }

  async sendCommand(): Promise<string> {
    return "";
  }

  async getSystemStatus(): Promise<SystemStatus> {
    return mockSystemStatus;
  }

  async getActiveCalls(): Promise<ActiveCall[]> {
    return this.mockCalls;
  }

  async getExtensions(): Promise<Extension[]> {
    return mockExtensions;
  }

  async getVoicemailBoxes(): Promise<VoicemailBox[]> {
    return mockVoicemail;
  }

  async originateCall(): Promise<void> {}

  async transferCall(): Promise<void> {}

  async hangupCall(): Promise<void> {}
}

const globalKey = Symbol.for("open-pbx-asterisk-manager");

type GlobalWithManager = typeof globalThis & {
  [globalKey]?: IAsteriskManager;
};

export const getAsteriskManager = (): IAsteriskManager => {
  const globalWithManager = globalThis as GlobalWithManager;
  if (!globalWithManager[globalKey]) {
    globalWithManager[globalKey] = hasCustomAmiCredentials()
      ? new AsteriskManager()
      : new MockAsteriskManager();
  }

  return globalWithManager[globalKey]!;
};
