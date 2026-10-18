import type { Metadata } from "next";

import { AgentReview } from "@/components/agent/agent-review";

function decode(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/investigation/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: decode(id) };
}

export default async function InvestigationPage({ params }: PageProps<"/investigation/[id]">) {
  const { id } = await params;
  const transactionId = decode(id);
  // Keyed by transaction so switching alerts starts a fresh session and
  // cancels the previous one's in-flight request.
  return <AgentReview key={transactionId} transactionId={transactionId} />;
}
