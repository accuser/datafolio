import type { Metadata } from "next";
import { Coverage } from "@/components/screens/Coverage";

export const metadata: Metadata = { title: "Coverage" };

export default function Page() {
  return <Coverage />;
}
