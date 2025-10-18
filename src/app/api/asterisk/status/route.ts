import { NextResponse } from "next/server";

import { getAsteriskManager } from "@/lib/asterisk";

export const runtime = "nodejs";

export async function GET() {
  const manager = getAsteriskManager();
  const status = await manager.getSystemStatus();
  return NextResponse.json(status, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
