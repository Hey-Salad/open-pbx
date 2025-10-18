import { NextResponse } from "next/server";

import { getAsteriskManager } from "@/lib/asterisk";

export const runtime = "nodejs";

const sockets = new Set<WebSocket>();
let isSubscribed = false;

const ensureSubscription = () => {
  if (isSubscribed) return;
  const manager = getAsteriskManager();
  manager.subscribe((event) => {
    const payload = JSON.stringify(event);
    for (const socket of sockets) {
      try {
        socket.send(payload);
      } catch (error) {
        console.error("[WS] Failed to deliver event", error);
        sockets.delete(socket);
      }
    }
  });

  isSubscribed = true;
};

export function GET(request: Request) {
  if (request.headers.get("upgrade") !== "websocket") {
    return NextResponse.json(
      { message: "Expected WebSocket upgrade" },
      { status: 400 },
    );
  }

  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];

  server.accept();
  sockets.add(server);
  ensureSubscription();

  void getAsteriskManager()
    .ready()
    .then((ready) => {
      if (ready) {
        server.send(
          JSON.stringify({
            type: "system",
            payload: { uptime: "Connected to Asterisk AMI" },
          }),
        );
      }
    })
    .catch((error) => {
      console.error("[WS] Ready check failed", error);
      server.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Unable to reach Asterisk" },
        }),
      );
    });

  server.addEventListener("close", () => {
    sockets.delete(server);
  });
  server.addEventListener("error", () => {
    sockets.delete(server);
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}
