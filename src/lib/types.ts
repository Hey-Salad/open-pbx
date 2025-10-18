export type ActiveCall = {
  channel: string;
  callerId: string;
  callee: string;
  state: string;
  duration: number;
  uniqueId?: string;
};

export type Extension = {
  id: string;
  state: "idle" | "ringing" | "busy" | "offline" | "unknown";
  callerId?: string;
  reachable: boolean;
  technology?: string;
};

export type SystemStatus = {
  uptime: string;
  version: string;
  activeChannels: number;
  callsProcessed: number;
  reloadRequired: boolean;
};

export type VoicemailBox = {
  mailbox: string;
  context: string;
  newMessages: number;
  oldMessages: number;
};

export type AmiEvent =
  | {
      type: "call";
      payload: ActiveCall;
      action: "created" | "updated" | "ended";
    }
  | {
      type: "extension";
      payload: Extension;
    }
  | {
      type: "voicemail";
      payload: VoicemailBox;
    }
  | {
      type: "system";
      payload: Partial<SystemStatus>;
    }
  | {
      type: "error";
      payload: { message: string };
    };
