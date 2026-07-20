import type { Metadata } from "next";
import { getStandard, ksbIndex } from "@/lib/standards";
import { KsbDetail } from "@/components/screens/KsbDetail";

// A distinct title per KSB is the navigation signal. The short name is resolved
// from the default standard's registry — enough to make the title meaningful
// server-side, where the user's per-repo standard isn't in hand; the id alone
// still differentiates a KSB from another standard. The screen itself renders
// against the real standard and 404s an id it doesn't recognise.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ksb = ksbIndex(getStandard(null))[id];
  return { title: ksb ? `${id} — ${ksb.short}` : id };
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <KsbDetail ksbId={id} />;
}
