import type { Metadata } from "next";
import { Suspense } from "react";
import { Repository } from "@/components/screens/Repository";

export const metadata: Metadata = { title: "Repository" };

export default function Page() {
  // Repository reads `?open=` via useSearchParams, which needs a Suspense
  // boundary so the rest of the route can still be prerendered.
  return (
    <Suspense fallback={null}>
      <Repository />
    </Suspense>
  );
}
