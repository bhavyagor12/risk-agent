import axios from 'axios';

export interface MoralisTokenBalance {
  token_address: string;
  name: string;
  symbol: string;
  logo?: string;
  thumbnail?: string;
  decimals: number;
  balance: string;
  possible_spam: boolean;
  verified_contract: boolean;
  total_supply?: string;
  total_supply_formatted?: string;
  percentage_relative_to_total_supply?: number;
}

export interface MoralisTransaction {
  hash: string;
  nonce: string;
  transaction_index: string;
  from_address: string;
  to_address: string;
  value: string;
  gas: string;
  gas_price: string;
  gas_used: string;
  cumulative_gas_used: string;
  input: string;
  receipt_cumulative_gas_used: string;
  receipt_gas_used: string;
  receipt_contract_address?: string;
  receipt_root?: string;
  receipt_status: string;
  block_timestamp: string;
  block_number: string;
  block_hash: string;
  transfer_index: number[];
  logs: any[];
}

export interface MoralisNativeBalance {
  balance: string;
  balance_formatted: string;
}

export interface MoralisDefiPosition {
  protocol_name: string;
  protocol_id: string;
  protocol_url?: string;
  protocol_logo?: string;
  total_usd_value: number;
  position_details: Array<{
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    balance: string;
    balance_formatted: string;
    usd_price: number;
    usd_value: number;
    portfolio_percentage: number;
  }>;
}

export class MoralisAPI {
  private apiKey: string;
  private baseUrl = 'https://deep-index.moralis.io/api/v2.2';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, params: any = {}): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        headers: {
          'X-API-Key': this.apiKey,
          'accept': 'application/json',
        },
        params: {
          chain: params.chain || 'eth',
          ...params
        }
      });
      return response.data;
    } catch (error: any) {
      console.error(`Moralis API error for ${endpoint}:`, error.response?.data || error.message);
      throw new Error(`Moralis API request failed: ${error.message}`);
    }
  }

  /**
   * Fetch native ETH balance
   */
  async getNativeBalance(address: string, chain: string = 'eth'): Promise<MoralisNativeBalance> {
    console.log(`💰 Fetching native balance for ${address} from Moralis...`);

    try {
      const data = await this.makeRequest(`/${address}/balance`, { chain });
      return {
        balance: data.balance,
        balance_formatted: (parseFloat(data.balance) / 1e18).toFixed(6)
      };
    } catch (error) {
      console.warn('Could not fetch native balance from Moralis');
      return {
        balance: '0',
        balance_formatted: '0'
      };
    }
  }

  /**
   * Fetch ERC20 token balances
   */
  async getTokenBalances(address: string, chain: string = 'eth'): Promise<MoralisTokenBalance[]> {
    console.log(`🪙 Fetching token balances for ${address} from Moralis...`);

    try {
      const data = await this.makeRequest(`/${address}/erc20`, {
        chain,
        exclude_spam: false,
        exclude_unverified_contracts: false
      });

      return data.result || [];
    } catch (error) {
      console.warn('Could not fetch token balances from Moralis');
      return [];
    }
  }

  /**
   * Fetch transaction history
   */
  async getTransactions(address: string, chain: string = 'eth', limit = 100): Promise<MoralisTransaction[]> {
    console.log(`📜 Fetching transactions for ${address} from Moralis...`);

    try {
      const data = await this.makeRequest(`/${address}`, {
        limit,
        chain,
        order: 'DESC'
      });

      return data.result || [];
    } catch (error) {
      console.warn('Could not fetch transactions from Moralis');
      return [];
    }
  }

  /**
   * Fetch DeFi positions (if available in Moralis plan)
   */
  async getDefiPositions(address: string, chain: string = 'eth'): Promise<MoralisDefiPosition[]> {
    console.log(`🏦 Fetching DeFi positions for ${address} from Moralis...`);

    try {
      // This endpoint might not be available in all Moralis plans
      const data = await this.makeRequest(`/wallets/${address}/defi/positions`, { chain });
      console.log(data, "defi positions");
      return data.result || [];
    } catch (error) {
      console.warn('Could not fetch DeFi positions from Moralis (might not be available in current plan)');
      return [];
    }
  }

  /**
   * Get token metadata
   */
  async getTokenMetadata(tokenAddress: string, chain: string = 'eth'): Promise<any> {
    console.log(`🔍 Fetching token metadata for ${tokenAddress} from Moralis...`);

    try {
      const data = await this.makeRequest(`/erc20/metadata`, {
        addresses: [tokenAddress],
        chain
      });

      return data[0] || null;
    } catch (error) {
      console.warn(`Could not fetch token metadata for ${tokenAddress}`);
      return null;
    }
  }

  /**
   * Get NFT balances
   */
  async getNFTBalances(address: string, chain: string = 'eth'): Promise<any[]> {
    console.log(`🖼️ Fetching NFT balances for ${address} from Moralis...`);

    try {
      const data = await this.makeRequest(`/${address}/nft`, {
        format: 'decimal',
        normalizeMetadata: true,
        exclude_spam: false,
        chain
      });

      return data.result || [];
    } catch (error) {
      console.warn('Could not fetch NFT balances from Moralis');
      return [];
    }
  }

  /**
   * Get wallet's net worth across multiple chains
   */
  async getNetWorth(address: string, chains: string[] = ['eth', 'polygon', 'arbitrum', 'base', 'optimism', 'linea']): Promise<{ total_networth_usd: string; chains: any[] }> {
    console.log(`💎 Fetching net worth for ${address} from Moralis across chains: ${chains.join(', ')}...`);

    try {
      const data = await this.makeRequest(`/wallets/${address}/net-worth`, {
        chains: chains,
        exclude_spam: true,
        exclude_unverified_contracts: true,
        max_token_inactivity: 1,
        min_pair_side_liquidity_usd: 1000
      });

      return data;
    } catch (error) {
      console.warn('Could not fetch net worth from Moralis');
      return {
        total_networth_usd: '0',
        chains: []
      };
    }
  }

  /**
   * Get wallet's profit and loss
   */
  async getProfitAndLoss(address: string, chain: string = 'eth'): Promise<any> {
    console.log(`📈 Fetching P&L for ${address} from Moralis...`);

    try {
      const data = await this.makeRequest(`/wallets/${address}/profitability/summary`, { chain });
      console.log(data);

      return data;
    } catch (error) {
      console.warn('Could not fetch P&L from Moralis');
      return {
        total_usd_value: 0,
        total_usd_value_change: 0,
        total_percentage_change: 0
      };
    }
  }

  /**
   * Get wallet token swaps
   */
  async getTokenSwaps(address: string, chain: string = 'eth', limit = 100): Promise<any[]> {
    console.log(`🔄 Fetching token swaps for ${address} from Moralis...`);

    try {
      const data = await this.makeRequest(`/wallets/${address}/history`, {
        chain,
        limit,
        order: 'DESC'
      });

      return data.result || [];
    } catch (error) {
      console.warn('Could not fetch token swaps from Moralis');
      return [];
    }
  }

  /**
   * Get wallet token approvals
   */
  async getTokenApprovals(address: string, chain: string = 'eth'): Promise<any[]> {
    console.log(`✅ Fetching token approvals for ${address} from Moralis...`);

    try {
      const data = await this.makeRequest(`/${address}/erc20/approvals`, {
        chain,
        limit: 100
      });

      return data.result || [];
    } catch (error) {
      console.warn('Could not fetch token approvals from Moralis');
      return [];
    }
  }

  /**
   * Get wallet details
   */
  async getWalletDetails(address: string, chain: string = 'eth'): Promise<any> {
    console.log(`ℹ️ Fetching wallet details for ${address} from Moralis...`);

    try {
      const data = await this.makeRequest(`/wallets/${address}/stats`, { chain });
      return data;
    } catch (error) {
      console.warn('Could not fetch wallet details from Moralis');
      return {};
    }
  }

  /**
   * Get comprehensive wallet portfolio data (Zerion-like functionality)
   */
  async getWalletPortfolio(address: string, chain: string = 'eth'): Promise<{
    totalValue: number;
    nativeBalance: any;
    tokenBalances: MoralisTokenBalance[];
    nftBalances: any[];
    defiPositions: MoralisDefiPosition[];
    netWorth: any;
    profitLoss: any;
  }> {
    console.log(`📊 Fetching comprehensive portfolio for ${address} from Moralis...`);

    try {
      // Fetch all data in parallel for better performance
      const [
        nativeBalance,
        tokenBalances, 
        nftBalances,
        defiPositions,
        netWorth,
        profitLoss
      ] = await Promise.all([
        this.getNativeBalance(address, chain),
        this.getTokenBalances(address, chain),
        this.getNFTBalances(address, chain),
        this.getDefiPositions(address, chain),
        this.getNetWorth(address),
        this.getProfitAndLoss(address, chain)
      ]);

      // Calculate total value
      const nativeValue = parseFloat(nativeBalance.balance_formatted) * 1800; // Rough ETH price
      const tokenValues = tokenBalances.reduce((sum, token) => {
        // This would need token price data, simplified for now
        return sum + parseFloat(token.balance) / Math.pow(10, token.decimals);
      }, 0);
      
      const totalValue = parseFloat(netWorth.total_networth_usd) || (nativeValue + tokenValues);

      return {
        totalValue,
        nativeBalance,
        tokenBalances,
        nftBalances,
        defiPositions,
        netWorth,
        profitLoss
      };
    } catch (error) {
      console.warn('Could not fetch comprehensive portfolio from Moralis');
      return {
        totalValue: 0,
        nativeBalance: { balance: '0', balance_formatted: '0' },
        tokenBalances: [],
        nftBalances: [],
        defiPositions: [],
        netWorth: { total_networth_usd: '0', chains: [] },
        profitLoss: { total_usd_value: 0, total_usd_value_change: 0, total_percentage_change: 0 }
      };
    }
  }
}

export default MoralisAPI;