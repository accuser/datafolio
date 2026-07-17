import { NextResponse } from "next/server";
import { isGitHubConfigured } from "@/lib/github/config";
import { getSession } from "@/lib/session";

export async function POST() {
  if (!isGitHubConfigured()) {
    return NextResponse.json({ ok: true });
  }
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
