import { getAsteriskManager } from "./asterisk";
import {
  ActiveCall,
  Extension,
  SystemStatus,
  VoicemailBox,
} from "./types";

export type DashboardSnapshot = {
  system: SystemStatus;
  calls: ActiveCall[];
  extensions: Extension[];
  voicemail: VoicemailBox[];
};

export const getDashboardSnapshot = async (): Promise<DashboardSnapshot> => {
  const manager = getAsteriskManager();
  const [system, calls, extensions, voicemail] = await Promise.all([
    manager.getSystemStatus(),
    manager.getActiveCalls(),
    manager.getExtensions(),
    manager.getVoicemailBoxes(),
  ]);

  return { system, calls, extensions, voicemail };
};
