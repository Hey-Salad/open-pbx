import type { AmiEvent } from "@/lib/types";

type Props = {
  event: AmiEvent | null;
};

const formatEvent = (event: AmiEvent | null): string => {
  if (!event) return "Waiting for events";
  switch (event.type) {
    case "call":
      return `${event.action === "ended" ? "Call ended" : "Call update"}: ${event.payload.callerId} → ${event.payload.callee}`;
    case "extension":
      return `Extension ${event.payload.id} is ${event.payload.state}`;
    case "voicemail":
      return `Mailbox ${event.payload.mailbox} has ${event.payload.newMessages} new messages`;
    case "system":
      return `System ${Object.keys(event.payload).join(", ")}`;
    case "error":
      return `Error: ${event.payload.message}`;
    default:
      return "Event received";
  }
};

export const EventFeed = ({ event }: Props) => (
  <section className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white shadow-sm dark:border-slate-800 dark:bg-black">
    <header className="mb-3">
      <h2 className="text-lg font-semibold">Live Event Feed</h2>
      <p className="text-sm text-slate-300">
        Latest notification streamed from the Asterisk manager.
      </p>
    </header>
    <div className="rounded-xl bg-black/40 px-4 py-6 font-mono text-sm text-emerald-300">
      {formatEvent(event)}
    </div>
  </section>
);
