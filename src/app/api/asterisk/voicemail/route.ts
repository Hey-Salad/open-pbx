import { NextResponse } from "next/server";

import { getAsteriskManager } from "@/lib/asterisk";

export const runtime = "nodejs";

export async function GET() {
  const manager = getAsteriskManager();
  const voicemail = await manager.getVoicemailBoxes();
  return NextResponse.json(voicemail, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
