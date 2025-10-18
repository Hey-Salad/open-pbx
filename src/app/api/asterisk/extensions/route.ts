import { NextResponse } from "next/server";

import { getAsteriskManager } from "@/lib/asterisk";

export const runtime = "nodejs";

export async function GET() {
  const manager = getAsteriskManager();
  const extensions = await manager.getExtensions();
  return NextResponse.json(extensions, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
