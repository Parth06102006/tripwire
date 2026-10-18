import type { Metadata } from "next";

import LandingView from "@/components/landing/landing-view";

export const metadata: Metadata = {
  title: { absolute: "Tripwire | Follow the money. Uncover the network." },
  description:
    "Tripwire is a graph-powered AML investigation workbench on a synthetic IBM AMLworld replay. Score suspicious transfers, trace bounded money-flow paths through FalkorDB, and read investigation reports where every claim is checked against the records behind it.",
};

export default function LandingPage() {
  return <LandingView />;
}
