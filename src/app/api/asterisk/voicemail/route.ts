import { NextResponse } from "next/server";

import { getAsteriskManager } from "@/lib/asterisk";

export const runtime = "nodejs";

export async function GET() {
  try {
    const voicemail = await getAsteriskManager().getVoicemailBoxes();
    return NextResponse.json({ voicemail });
  } catch (error) {
    console.error("[API] Failed to fetch voicemail", error);
    return NextResponse.json(
      { message: "Unable to fetch voicemail" },
      { status: 500 },
    );
  }
}
