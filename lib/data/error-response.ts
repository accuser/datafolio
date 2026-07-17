import "server-only";
import { NextResponse } from "next/server";
import { CONFLICT_MESSAGE } from "./github-store";

// Map a thrown store/GitHub error to a client-safe JSON response. Raw GitHub
// error text is logged server-side but never relayed to the client on a 502.
export function storeErrorResponse(context: string, e: unknown): NextResponse {
  const message = (e as Error)?.message ?? "";
  if (message.includes("not found")) {
    return NextResponse.json(
      { error: "That evidence item no longer exists." },
      { status: 404 },
    );
  }
  if (message === CONFLICT_MESSAGE) {
    return NextResponse.json({ error: message }, { status: 409 });
  }
  console.error(`${context} failed:`, e);
  return NextResponse.json(
    { error: "Something went wrong talking to GitHub. Please try again." },
    { status: 502 },
  );
}
