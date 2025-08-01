import Moralis from 'moralis';

// Initialize Moralis (should be called once at app startup)
export async function initializeMoralis(apiKey: string) {
  if (!Moralis.Core.isStarted) {
    await Moralis.start({
      apiKey: apiKey,
    });
  }
}

// Types for our wallet analysis
export interface WalletAsset {
  token_address: string;
  name: string;
  symbol: string;
  balance: string;
  decimals: number;
  usd_value?: number;
  percentage_relative_to_total_supply?: number;
}

export interface WalletTransaction {
  hash: string;
  block_timestamp: string;
  from_address: string;
  to_address: string;
  value: string;
  gas: string;
  gas_price: string;
  gas_used?: string;
  input?: string;
}

export interface DeFiPosition {
  protocol_name: string;
  protocol_id: string;
  position_type: string;
  tokens: Array<{
    address: string;
    symbol: string;
    amount: string;
    usd_value?: number;
  }>;
  total_usd_value?: number;
}

export interface WalletAnalysis {
  address: string;
  assets: WalletAsset[];
  transactions: WalletTransaction[];
  defi_positions: DeFiPosition[];
  protocols_interacted: string[];
  total_portfolio_value: number;
  transaction_count_30d: number;
  first_transaction_date?: string;
  last_transaction_date?: string;
  risk_indicators: {
    interacted_with_mixers: boolean;
    high_value_transactions: boolean;
    new_wallet: boolean;
    diverse_protocols: boolean;
  };
}

/**
 * Get all ERC20 tokens held by a wallet
 */
export async function getWalletTokens(
  address: string,
  chain: string = 'eth'
): Promise<WalletAsset[]> {
  try {
    const response = await Moralis.EvmApi.token.getWalletTokenBalances({
      address,
      chain,
    });

    return response.raw.map((token: any) => ({
      token_address: token.token_address,
      name: token.name || 'Unknown',
      symbol: token.symbol || 'UNKNOWN',
      balance: token.balance,
      decimals: token.decimals,
      usd_value: token.usd_value || 0,
      percentage_relative_to_total_supply: token.percentage_relative_to_total_supply,
    }));
  } catch (error) {
    console.error('Error fetching wallet tokens:', error);
    return [];
  }
}

/**
 * Get native token balance (ETH)
 */
export async function getNativeBalance(
  address: string,
  chain: string = 'eth'
): Promise<{ balance: string; usd_value?: number }> {
  try {
    const response = await Moralis.EvmApi.balance.getNativeBalance({
      address,
      chain,
    });

    return {
      balance: response.raw.balance,
      usd_value: (response.raw as any).usd_value,
    };
  } catch (error) {
    console.error('Error fetching native balance:', error);
    return { balance: '0' };
  }
}

/**
 * Get wallet transaction history
 */
export async function getWalletTransactions(
  address: string,
  chain: string = 'eth',
  limit: number = 100
): Promise<WalletTransaction[]> {
  try {
    const response = await Moralis.EvmApi.transaction.getWalletTransactions({
      address,
      chain,
      limit,
    });

    return (response.raw as any).result.map((tx: any) => ({
      hash: tx.hash,
      block_timestamp: tx.block_timestamp,
      from_address: tx.from_address,
      to_address: tx.to_address,
      value: tx.value,
      gas: tx.gas,
      gas_price: tx.gas_price,
      gas_used: tx.receipt_gas_used,
      input: tx.input,
    }));
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    return [];
  }
}

/**
 * Get DeFi positions for a wallet
 */
export async function getWalletDeFiPositions(
  address: string,
  chain: string = 'eth'
): Promise<DeFiPosition[]> {
  try {
    const response = await Moralis.EvmApi.wallets.getDefiPositionsSummary({
      address,
      chain,
    });

    return (response.raw as any).result?.map((position: any) => ({
      protocol_name: position.protocol_name,
      protocol_id: position.protocol_id,
      position_type: position.position_type,
      tokens: position.tokens || [],
      total_usd_value: position.total_usd_value,
    })) || [];
  } catch (error) {
    console.error('Error fetching DeFi positions:', error);
    return [];
  }
}

/**
 * Get protocols the wallet has interacted with
 */
export async function getWalletProtocols(
  address: string,
  chain: string = 'eth'
): Promise<string[]> {
  try {
    // Get recent transactions to analyze protocol interactions
    const transactions = await getWalletTransactions(address, chain, 500);
    
    // Known protocol addresses (you can expand this list)
    const protocolMap: { [key: string]: string } = {
      '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9': 'Aave V2',
      '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2': 'Aave V3',
      '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f': 'SushiSwap',
      '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2',
      '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3',
      '0x1f98431c8ad98523631ae4a59f267346ea31f984': 'Uniswap V3 Factory',
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'WETH',
    };

    const protocols = new Set<string>();
    
    transactions.forEach(tx => {
      if (tx.to_address && protocolMap[tx.to_address.toLowerCase()]) {
        protocols.add(protocolMap[tx.to_address.toLowerCase()]);
      }
    });

    return Array.from(protocols);
  } catch (error) {
    console.error('Error fetching wallet protocols:', error);
    return [];
  }
}

/**
 * Analyze wallet for risk indicators
 */
export function analyzeRiskIndicators(
  transactions: WalletTransaction[],
  assets: WalletAsset[],
  defiPositions: DeFiPosition[]
): WalletAnalysis['risk_indicators'] {
  // Known mixer addresses (Tornado Cash, etc.)
  const mixerAddresses = [
    '0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc', // Tornado Cash ETH
    '0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936', // Tornado Cash 0.1 ETH
    '0x910cbd523d972eb0a6f4cae4618ad62622b39dbf', // Tornado Cash 1 ETH
  ];

  const interacted_with_mixers = transactions.some(tx => 
    mixerAddresses.includes(tx.to_address?.toLowerCase() || '')
  );

  const high_value_transactions = transactions.some(tx => 
    parseFloat(tx.value) > 10 * Math.pow(10, 18) // > 10 ETH
  );

  const first_tx_date = transactions.length > 0 ? 
    new Date(transactions[transactions.length - 1].block_timestamp) : new Date();
  const new_wallet = (Date.now() - first_tx_date.getTime()) < (30 * 24 * 60 * 60 * 1000); // < 30 days

  const diverse_protocols = defiPositions.length > 3;

  return {
    interacted_with_mixers,
    high_value_transactions,
    new_wallet,
    diverse_protocols,
  };
}

/**
 * Get comprehensive wallet analysis
 */
export async function getComprehensiveWalletAnalysis(
  address: string,
  chain: string = 'eth'
): Promise<WalletAnalysis> {
  try {
    // Fetch all data in parallel for better performance
    const [
      tokens,
      nativeBalance,
      transactions,
      defiPositions,
      protocols
    ] = await Promise.all([
      getWalletTokens(address, chain),
      getNativeBalance(address, chain),
      getWalletTransactions(address, chain, 500),
      getWalletDeFiPositions(address, chain),
      getWalletProtocols(address, chain)
    ]);

    // Add native ETH to assets
    const assets: WalletAsset[] = [
      {
        token_address: '0x0000000000000000000000000000000000000000',
        name: 'Ethereum',
        symbol: 'ETH',
        balance: nativeBalance.balance,
        decimals: 18,
        usd_value: nativeBalance.usd_value || 0,
      },
      ...tokens
    ];

    // Calculate total portfolio value
    const total_portfolio_value = assets.reduce((total, asset) => {
      return total + (asset.usd_value || 0);
    }, 0);

    // Filter transactions from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recent_transactions = transactions.filter(tx => 
      new Date(tx.block_timestamp) > thirtyDaysAgo
    );

    const risk_indicators = analyzeRiskIndicators(transactions, assets, defiPositions);

    return {
      address,
      assets,
      transactions: recent_transactions,
      defi_positions: defiPositions,
      protocols_interacted: protocols,
      total_portfolio_value,
      transaction_count_30d: recent_transactions.length,
      first_transaction_date: transactions.length > 0 ? 
        transactions[transactions.length - 1].block_timestamp : undefined,
      last_transaction_date: transactions.length > 0 ? 
        transactions[0].block_timestamp : undefined,
      risk_indicators,
    };
  } catch (error) {
    console.error('Error in comprehensive wallet analysis:', error);
    throw error;
  }
}

/**
 * Format wallet analysis for risk assessment
 */
export function formatWalletAnalysisForRisk(analysis: WalletAnalysis): string {
  return `
Wallet Address: ${analysis.address}

Portfolio Overview:
- Total Value: $${analysis.total_portfolio_value.toFixed(2)}
- Number of Assets: ${analysis.assets.length}
- Transaction Count (30d): ${analysis.transaction_count_30d}

Assets Held:
${analysis.assets
  .filter(asset => parseFloat(asset.balance) > 0)
  .slice(0, 10) // Top 10 assets
  .map(asset => `- ${asset.symbol}: ${(parseFloat(asset.balance) / Math.pow(10, asset.decimals)).toFixed(4)} ${asset.usd_value ? `($${asset.usd_value.toFixed(2)})` : ''}`)
  .join('\n')}

DeFi Positions:
${analysis.defi_positions.length > 0 ? 
  analysis.defi_positions.map(pos => 
    `- ${pos.protocol_name}: ${pos.position_type} ${pos.total_usd_value ? `($${pos.total_usd_value.toFixed(2)})`: ''}`
  ).join('\n') : 
  '- No active DeFi positions detected'
}

Protocols Interacted With:
${analysis.protocols_interacted.length > 0 ? 
  analysis.protocols_interacted.map(protocol => `- ${protocol}`).join('\n') : 
  '- No known protocol interactions detected'
}

Risk Indicators:
- Mixer Interactions: ${analysis.risk_indicators.interacted_with_mixers ? 'Yes ⚠️' : 'No ✅'}
- High Value Transactions: ${analysis.risk_indicators.high_value_transactions ? 'Yes ⚠️' : 'No ✅'}
- New Wallet: ${analysis.risk_indicators.new_wallet ? 'Yes ⚠️' : 'No ✅'}
- Diverse Protocol Usage: ${analysis.risk_indicators.diverse_protocols ? 'Yes ✅' : 'No ⚠️'}

Wallet Activity Timeline:
- First Transaction: ${analysis.first_transaction_date || 'Unknown'}
- Last Transaction: ${analysis.last_transaction_date || 'Unknown'}
`.trim();
}