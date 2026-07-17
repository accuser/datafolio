import { NextResponse } from "next/server";
import { isGitHubConfigured } from "@/lib/github/config";
import { getSession } from "@/lib/session";

// Report the current identity so the client can decide whether to run against
// GitHub or the mock, and whether the signed-in user is the repo owner
// (learner) or a collaborator (coach).
export async function GET() {
  if (!isGitHubConfigured()) {
    return NextResponse.json({ configured: false, user: null });
  }
  const session = await getSession();
  if (!session.user) {
    return NextResponse.json({ configured: true, user: null });
  }
  const { user, target } = session;
  const role =
    target && target.owner
      ? user.login.toLowerCase() === target.owner.toLowerCase()
        ? "learner"
        : "coach"
      : "unknown";
  return NextResponse.json({ configured: true, user, target, role });
}
