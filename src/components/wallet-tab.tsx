// components/wallet-tab.tsx

"use client";
import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface WalletTabProps {
  address: string;
}

interface WalletData {
  address: string;
  last_updated: string;
  analysis_version: string;
  raw_data: {
    moralis: {
      ethereum: {
        portfolio: {
          totalValue: number;
          nativeBalance: {
            balance: string;
            balance_formatted: string;
          };
          tokenBalances: any[];
          nftBalances: any[];
          defiPositions: any[];
          netWorth: {
            total_networth_usd: string;
            chains: Array<{
              chain: string;
              native_balance: string;
              native_balance_formatted: string;
              native_balance_usd: string;
              token_balance_usd: string;
              networth_usd: string;
            }>;
          };
          profitLoss: {
            total_count_of_trades: number;
            total_trade_volume: string;
            total_realized_profit_usd: string;
            total_realized_profit_percentage: number;
            total_buys: number;
            total_sells: number;
            total_sold_volume_usd: string;
            total_bought_volume_usd: string;
          };
        };
        net_worth: {
          total_networth_usd: string;
          chains: Array<{
            chain: string;
            native_balance: string;
            native_balance_formatted: string;
            native_balance_usd: string;
            token_balance_usd: string;
            networth_usd: string;
          }>;
        };
        transactions: any[];
      };
    };
  };
  analysis: {
    pools: {
      gpt_analysis: string;
      risk_score: number;
      key_findings: string[];
      recommendations: string[];
      processed_at: string;
    };
    assets: {
      gpt_analysis: string;
      risk_score: number;
      key_findings: string[];
      recommendations: string[];
      processed_at: string;
    };
    protocols: {
      gpt_analysis: string;
      risk_score: number;
      key_findings: string[];
      recommendations: string[];
      processed_at: string;
    };
  };
  final_analysis: {
    overall_risk_score: number;
    risk_level: string;
    confidence_score: number;
    gpt_summary: string;
    key_risks: string[];
    recommendations: string[];
    alerts: Array<{
      severity: string;
      message: string;
    }>;
    multiChainInfo: {
      totalChainsActive: number;
      chainsWithActivity: string[];
      crossChainRisks: string[];
      chainSpecificRisks: Record<string, string[]>;
    };
    processed_at: string;
  };
}

export default function WalletTab({ address }: WalletTabProps) {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWalletData = async () => {
      try {
        setLoading(true);
        // Load from the data/wallets directory
        const response = await fetch(`/data/wallets/${address}.json`);
        if (!response.ok) {
          throw new Error(`Failed to load wallet data: ${response.status}`);
        }
        const walletData = await response.json();
        setData(walletData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load wallet data');
      } finally {
        setLoading(false);
      }
    };

    fetchWalletData();
  }, [address]);

  if (loading) {
    return (
      <div className="border rounded-xl p-6 mt-4 shadow-sm bg-white">
        <div className="flex items-center justify-center h-32">
          <p className="text-gray-500">Loading wallet data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-xl p-6 mt-4 shadow-sm bg-white">
        <div className="text-red-600">
          <h3 className="font-semibold mb-2">Error Loading Wallet Data</h3>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="border rounded-xl p-6 mt-4 shadow-sm bg-white">
        <p className="text-gray-500">No wallet data available</p>
      </div>
    );
  }

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const getRiskBadgeColor = (score: number) => {
    if (score >= 70) return 'bg-red-100 text-red-800';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="border rounded-xl p-6 mt-4 shadow-sm bg-white">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Wallet Analysis</h2>
        <p className="text-sm text-gray-600 break-all mb-2">{address}</p>
        <p className="text-xs text-gray-500">
          Last updated: {new Date(data.last_updated).toLocaleString()}
        </p>
      </div>

      <Accordion type="multiple" className="w-full">
        <AccordionItem value="overview">
          <AccordionTrigger className="text-left">
            <div className="flex items-center gap-3">
              <span className="font-medium">Risk Overview</span>
              <span className={`px-2 py-1 text-xs rounded-full ${getRiskBadgeColor(data.final_analysis.overall_risk_score)}`}>
                Risk Score: {data.final_analysis.overall_risk_score}/100
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-gray-600">Risk Level</p>
                  <p className={`text-lg font-semibold capitalize ${
                    data.final_analysis.risk_level === 'high' ? 'text-red-600' :
                    data.final_analysis.risk_level === 'medium' ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {data.final_analysis.risk_level}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-gray-600">Confidence</p>
                  <p className="text-lg font-semibold">{data.final_analysis.confidence_score}%</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-gray-600">Active Chains</p>
                  <p className="text-lg font-semibold">{data.final_analysis.multiChainInfo.totalChainsActive}</p>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Summary</h4>
                <p className="text-sm text-gray-700">{data.final_analysis.gpt_summary}</p>
              </div>

              {data.final_analysis.alerts.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Alerts</h4>
                  <div className="space-y-2">
                    {data.final_analysis.alerts.map((alert, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className={`text-xs font-medium uppercase ${getSeverityColor(alert.severity)}`}>
                          {alert.severity}
                        </span>
                        <span className="text-sm text-gray-700">{alert.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="portfolio">
          <AccordionTrigger className="text-left">
            <div className="flex items-center gap-3">
              <span className="font-medium">Portfolio Overview</span>
              <span className="text-sm text-gray-600">
                {formatCurrency(data.raw_data.moralis.ethereum.portfolio.totalValue)}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Net Worth</h4>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(data.raw_data.moralis.ethereum.portfolio.netWorth.total_networth_usd)}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Native Balance (ETH)</h4>
                  <p className="text-lg font-semibold">
                    {parseFloat(data.raw_data.moralis.ethereum.portfolio.nativeBalance.balance_formatted).toFixed(4)} ETH
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{data.raw_data.moralis.ethereum.portfolio.tokenBalances.length}</p>
                  <p className="text-sm text-gray-600">Token Types</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{data.raw_data.moralis.ethereum.portfolio.nftBalances.length}</p>
                  <p className="text-sm text-gray-600">NFTs</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{data.raw_data.moralis.ethereum.portfolio.defiPositions.length}</p>
                  <p className="text-sm text-gray-600">DeFi Positions</p>
                </div>
              </div>

              {data.raw_data.moralis.ethereum.portfolio.profitLoss && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Trading Performance</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Total Trades</p>
                      <p className="font-semibold">{data.raw_data.moralis.ethereum.portfolio.profitLoss.total_count_of_trades}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Profit/Loss</p>
                      <p className={`font-semibold ${parseFloat(data.raw_data.moralis.ethereum.portfolio.profitLoss.total_realized_profit_usd) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(data.raw_data.moralis.ethereum.portfolio.profitLoss.total_realized_profit_usd)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Buys/Sells</p>
                      <p className="font-semibold">
                        {data.raw_data.moralis.ethereum.portfolio.profitLoss.total_buys}/{data.raw_data.moralis.ethereum.portfolio.profitLoss.total_sells}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">ROI</p>
                      <p className={`font-semibold ${data.raw_data.moralis.ethereum.portfolio.profitLoss.total_realized_profit_percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {data.raw_data.moralis.ethereum.portfolio.profitLoss.total_realized_profit_percentage.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="protocols">
          <AccordionTrigger className="text-left">
            <div className="flex items-center gap-3">
              <span className="font-medium">Protocol Analysis</span>
              <span className={`px-2 py-1 text-xs rounded-full ${getRiskBadgeColor(data.analysis.protocols.risk_score)}`}>
                Risk: {data.analysis.protocols.risk_score}/100
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Analysis</h4>
                <p className="text-sm text-gray-700">{data.analysis.protocols.gpt_analysis}</p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Key Findings</h4>
                <ul className="list-disc list-inside space-y-1">
                  {data.analysis.protocols.key_findings.map((finding, idx) => (
                    <li key={idx} className="text-sm text-gray-700">{finding}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">Recommendations</h4>
                <ul className="list-disc list-inside space-y-1">
                  {data.analysis.protocols.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-sm text-blue-700">{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="pools">
          <AccordionTrigger className="text-left">
            <div className="flex items-center gap-3">
              <span className="font-medium">DeFi Pools Analysis</span>
              <span className={`px-2 py-1 text-xs rounded-full ${getRiskBadgeColor(data.analysis.pools.risk_score)}`}>
                Risk: {data.analysis.pools.risk_score}/100
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Analysis</h4>
                <p className="text-sm text-gray-700">{data.analysis.pools.gpt_analysis}</p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Key Findings</h4>
                <ul className="list-disc list-inside space-y-1">
                  {data.analysis.pools.key_findings.map((finding, idx) => (
                    <li key={idx} className="text-sm text-gray-700">{finding}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">Recommendations</h4>
                <ul className="list-disc list-inside space-y-1">
                  {data.analysis.pools.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-sm text-blue-700">{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="assets">
          <AccordionTrigger className="text-left">
            <div className="flex items-center gap-3">
              <span className="font-medium">Assets Analysis</span>
              <span className={`px-2 py-1 text-xs rounded-full ${getRiskBadgeColor(data.analysis.assets.risk_score)}`}>
                Risk: {data.analysis.assets.risk_score}/100
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Analysis</h4>
                <p className="text-sm text-gray-700">{data.analysis.assets.gpt_analysis}</p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Key Findings</h4>
                <ul className="list-disc list-inside space-y-1">
                  {data.analysis.assets.key_findings.map((finding, idx) => (
                    <li key={idx} className="text-sm text-gray-700">{finding}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">Recommendations</h4>
                <ul className="list-disc list-inside space-y-1">
                  {data.analysis.assets.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-sm text-blue-700">{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="multichain">
          <AccordionTrigger className="text-left">
            <span className="font-medium">Multi-Chain Activity</span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Active Chains</h4>
                  <div className="flex flex-wrap gap-2">
                    {data.final_analysis.multiChainInfo.chainsWithActivity.map((chain, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full capitalize">
                        {chain}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Cross-Chain Risks</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {data.final_analysis.multiChainInfo.crossChainRisks.map((risk, idx) => (
                      <li key={idx} className="text-sm text-red-700">{risk}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Chain-Specific Risks</h4>
                <div className="space-y-3">
                  {Object.entries(data.final_analysis.multiChainInfo.chainSpecificRisks).map(([chain, risks]) => (
                    <div key={chain} className="bg-gray-50 p-3 rounded-lg">
                      <h5 className="font-medium text-sm mb-1 capitalize">{chain}</h5>
                      <ul className="list-disc list-inside space-y-1">
                        {risks.map((risk, idx) => (
                          <li key={idx} className="text-sm text-gray-700">{risk}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="risks-recommendations">
          <AccordionTrigger className="text-left">
            <span className="font-medium">Key Risks & Recommendations</span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2 text-red-600">Key Risks</h4>
                <ul className="list-disc list-inside space-y-1">
                  {data.final_analysis.key_risks.map((risk, idx) => (
                    <li key={idx} className="text-sm text-red-700">{risk}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2 text-blue-600">Recommendations</h4>
                <ul className="list-disc list-inside space-y-1">
                  {data.final_analysis.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-sm text-blue-700">{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
