import { NextResponse } from "next/server";

import { getAsteriskManager } from "@/lib/asterisk";

export const runtime = "nodejs";

type OriginatePayload = {
  channel: string;
  exten: string;
  context: string;
  priority?: number;
  callerId?: string;
  timeoutMs?: number;
};

type TransferPayload = {
  channel: string;
  exten: string;
  context: string;
  priority?: number;
};

type HangupPayload = {
  channel: string;
};

type ActionRequest =
  | {
      action: "originate";
      payload: OriginatePayload;
    }
  | {
      action: "transfer";
      payload: TransferPayload;
    }
  | {
      action: "hangup";
      payload: HangupPayload;
    };

const isValidPayload = (body: unknown): body is ActionRequest => {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Partial<ActionRequest> & Record<string, unknown>;

  switch (candidate.action) {
    case "originate": {
      const payload = candidate.payload as OriginatePayload | undefined;
      return Boolean(
        payload?.channel && payload.exten && payload.context,
      );
    }
    case "transfer": {
      const payload = candidate.payload as TransferPayload | undefined;
      return Boolean(payload?.channel && payload.exten && payload.context);
    }
    case "hangup": {
      const payload = candidate.payload as HangupPayload | undefined;
      return Boolean(payload?.channel);
    }
    default:
      return false;
  }
};

export async function POST(request: Request) {
  let payload: ActionRequest;
  try {
    const body = await request.json();
    if (!isValidPayload(body)) {
      return NextResponse.json(
        { message: "Invalid action payload" },
        { status: 400 },
      );
    }
    payload = body;
  } catch (error) {
    console.error("[API] Invalid request body", error);
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const manager = getAsteriskManager();

  try {
    switch (payload.action) {
      case "originate":
        await manager.originateCall(payload.payload);
        break;
      case "transfer":
        await manager.transferCall(payload.payload);
        break;
      case "hangup":
        await manager.hangupCall(payload.payload.channel);
        break;
      default:
        return NextResponse.json(
          { message: "Unsupported action" },
          { status: 400 },
        );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[API] Asterisk action failed", error);
    return NextResponse.json(
      { message: "Unable to complete AMI action" },
      { status: 500 },
    );
  }
}
