import type { Metadata } from "next";

import LandingView from "@/components/landing/landing-view";

export const metadata: Metadata = {
  title: { absolute: "Tripwire | Follow the money. Uncover the network." },
  description:
    "Tripwire is an AI-powered graph AML detection and investigation workbench. Score suspicious transfers, trace bounded money-flow paths through FalkorDB, and generate evidence-validated dossiers.",
};

export default function LandingPage() {
  return <LandingView />;
}
