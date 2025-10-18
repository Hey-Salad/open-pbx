import { NextResponse } from "next/server";

import { getAsteriskManager } from "@/lib/asterisk";
import { AmiEvent } from "@/lib/types";

export const runtime = "nodejs";

const buildEvent = (event: AmiEvent): string =>
  `data: ${JSON.stringify(event)}\n\n`;

export async function GET(request: Request) {
  const manager = getAsteriskManager();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const push = (event: AmiEvent) => {
        controller.enqueue(encoder.encode(buildEvent(event)));
      };

      const unsubscribe = manager.subscribe(push);
      push({
        type: "system",
        payload: { uptime: "Subscribed to AMI events" },
      });

      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`));
      }, 15000);

      if ("unref" in keepAlive && typeof keepAlive.unref === "function") {
        keepAlive.unref();
      }

      const abortHandler = () => {
        clearInterval(keepAlive);
        unsubscribe();
        controller.close();
      };

      request.signal.addEventListener("abort", abortHandler);
    },
    cancel() {
      // Stream cancelled by the browser.
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
