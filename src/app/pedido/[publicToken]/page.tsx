import { PedidoStatusClient } from "./PedidoStatusClient";

export default async function PedidoStatusPage({
  params,
}: {
  params: Promise<{ publicToken: string }>;
}) {
  const { publicToken } = await params;

  return <PedidoStatusClient publicToken={decodeURIComponent(publicToken)} />;
}
