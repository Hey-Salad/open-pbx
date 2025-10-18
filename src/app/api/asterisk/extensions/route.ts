import { NextResponse } from "next/server";

import { getAsteriskManager } from "@/lib/asterisk";

export const runtime = "nodejs";

export async function GET() {
  try {
    const extensions = await getAsteriskManager().getExtensions();
    return NextResponse.json({ extensions });
  } catch (error) {
    console.error("[API] Failed to fetch extensions", error);
    return NextResponse.json(
      { message: "Unable to fetch extensions" },
      { status: 500 },
    );
  }
}
