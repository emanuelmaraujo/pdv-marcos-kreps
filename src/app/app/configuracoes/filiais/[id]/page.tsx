import { BranchEditorView } from "../BranchEditorView";

export default async function EditarFilialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BranchEditorView branchId={id} />;
}
