import { ActiveCall, Extension, SystemStatus, VoicemailBox } from "./types";

export const mockSystemStatus: SystemStatus = {
  uptime: "2 days 4 hours",
  version: "Asterisk 20.5.1",
  activeChannels: 3,
  callsProcessed: 128,
  reloadRequired: false,
};

export const mockExtensions: Extension[] = [
  {
    id: "1001",
    state: "idle",
    reachable: true,
    technology: "PJSIP",
  },
  {
    id: "1002",
    state: "ringing",
    reachable: true,
    callerId: "Bob",
    technology: "PJSIP",
  },
  {
    id: "1003",
    state: "offline",
    reachable: false,
    technology: "PJSIP",
  },
];

export const mockCalls: ActiveCall[] = [
  {
    channel: "PJSIP/1002-00000012",
    callerId: "Bob <1002>",
    callee: "Support Queue",
    state: "Up",
    duration: 92,
    uniqueId: "169341234.12",
  },
  {
    channel: "PJSIP/1004-00000015",
    callerId: "Switchboard <1004>",
    callee: "SIP/Trunk-0000012",
    state: "Ring",
    duration: 15,
    uniqueId: "169341234.15",
  },
];

export const mockVoicemail: VoicemailBox[] = [
  {
    mailbox: "1001",
    context: "default",
    newMessages: 1,
    oldMessages: 5,
  },
  {
    mailbox: "1002",
    context: "default",
    newMessages: 0,
    oldMessages: 2,
  },
];
