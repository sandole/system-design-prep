import type { Metadata } from "next";
import Calculator from "@/components/Calculator";

export const metadata: Metadata = {
  title: "Back-of-Envelope Calculator",
  description:
    "Turn DAU and usage assumptions into QPS, storage, bandwidth, and cache size estimates for system design interviews.",
};

export default function CalculatorPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white">
        Back-of-Envelope Calculator
      </h1>
      <p className="mt-2 mb-8 max-w-2xl text-slate-400">
        Every design starts with estimation. Plug in your assumptions and get
        the numbers that shape the architecture: QPS tells you how many servers,
        storage tells you which database, bandwidth tells you whether you need a
        CDN.
      </p>
      <Calculator />
    </div>
  );
}
