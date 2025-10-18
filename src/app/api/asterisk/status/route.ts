import { NextResponse } from "next/server";

import { getAsteriskManager } from "@/lib/asterisk";

export const runtime = "nodejs";

export async function GET() {
  const manager = getAsteriskManager();

  try {
    const [system, calls, extensions, voicemail] = await Promise.all([
      manager.getSystemStatus(),
      manager.getActiveCalls(),
      manager.getExtensions(),
      manager.getVoicemailBoxes(),
    ]);

    return NextResponse.json({
      system,
      calls,
      extensions,
      voicemail,
    });
  } catch (error) {
    console.error("[API] Failed to load dashboard status", error);
    return NextResponse.json(
      { message: "Unable to load Asterisk status" },
      { status: 500 },
    );
  }
}
