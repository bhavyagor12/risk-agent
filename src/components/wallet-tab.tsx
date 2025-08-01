// components/wallet-tab.tsx

"use client";
import { useEffect, useState } from "react";

interface WalletTabProps {
  address: string;
}

interface RiskResult {
  wallet: string;
  risk_score: number;
  summary: string;
  key_factors: string[];
  concerns: string[];
  confidence_level: "high" | "medium" | "low";
  final_notes: string;
}

export default function WalletTab({ address }: WalletTabProps) {
  const [data, setData] = useState<RiskResult | null>(null);

  useEffect(() => {
    const fetchRisk = async () => {
      const res = await fetch(`/static/risk/${address}.json`);
      const json = await res.json();
      setData(json);
    };
    fetchRisk();
  }, [address]);

  return (
    <div className="border rounded-xl p-6 mt-4 shadow-sm bg-white">
      <h2 className="text-xl font-semibold mb-2">Address</h2>
      <p className="text-sm break-all mb-4">{address}</p>
      {data ? (
        <div className="space-y-2">
          <div className="font-medium">
            Risk Score: <span className="font-normal">{data.risk_score}</span>
          </div>
          <div className="font-medium">
            Summary: <span className="font-normal">{data.summary}</span>
          </div>
          <div className="font-medium">
            Confidence:{" "}
            <span className="font-normal capitalize">
              {data.confidence_level}
            </span>
          </div>
          <div className="font-medium">
            Key Factors:
            <ul className="list-disc ml-6 text-sm">
              {data.key_factors.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
          <div className="font-medium">
            Concerns:
            <ul className="list-disc ml-6 text-sm text-red-600">
              {data.concerns.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
          <div className="text-sm mt-4 italic">{data.final_notes}</div>
        </div>
      ) : (
        <p>Loading risk evaluation...</p>
      )}
    </div>
  );
}
