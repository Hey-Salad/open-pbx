import { NextResponse } from "next/server";

import { getAsteriskManager } from "@/lib/asterisk";

export const runtime = "nodejs";

export async function GET() {
  const manager = getAsteriskManager();
  const calls = await manager.getActiveCalls();
  return NextResponse.json(calls, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
