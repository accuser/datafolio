import { AddEvidence } from "@/components/screens/AddEvidence";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  return <AddEvidence ksbId={id} editId={edit} />;
}
