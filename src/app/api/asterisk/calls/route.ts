import { NextResponse } from "next/server";

import { getAsteriskManager } from "@/lib/asterisk";

export const runtime = "nodejs";

export async function GET() {
  try {
    const calls = await getAsteriskManager().getActiveCalls();
    return NextResponse.json({ calls });
  } catch (error) {
    console.error("[API] Failed to fetch active calls", error);
    return NextResponse.json(
      { message: "Unable to fetch active calls" },
      { status: 500 },
    );
  }
}
