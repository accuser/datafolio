import { KsbDetail } from "@/components/screens/KsbDetail";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <KsbDetail ksbId={id} />;
}
