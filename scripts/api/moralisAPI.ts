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
          'Content-Type': 'application/json',
        },
        params: {
          chain: 'eth',
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
  async getNativeBalance(address: string): Promise<MoralisNativeBalance> {
    console.log(`💰 Fetching native balance for ${address} from Moralis...`);
    
    try {
      const data = await this.makeRequest(`/${address}/balance`);
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
  async getTokenBalances(address: string): Promise<MoralisTokenBalance[]> {
    console.log(`🪙 Fetching token balances for ${address} from Moralis...`);
    
    try {
      const data = await this.makeRequest(`/${address}/erc20`, {
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
  async getTransactions(address: string, limit = 100): Promise<MoralisTransaction[]> {
    console.log(`📜 Fetching transactions for ${address} from Moralis...`);
    
    try {
      const data = await this.makeRequest(`/${address}`, {
        limit,
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
  async getDefiPositions(address: string): Promise<MoralisDefiPosition[]> {
    console.log(`🏦 Fetching DeFi positions for ${address} from Moralis...`);
    
    try {
      // This endpoint might not be available in all Moralis plans
      const data = await this.makeRequest(`/${address}/defi/positions`);
      return data.result || [];
    } catch (error) {
      console.warn('Could not fetch DeFi positions from Moralis (might not be available in current plan)');
      return [];
    }
  }

  /**
   * Get token metadata
   */
  async getTokenMetadata(tokenAddress: string): Promise<any> {
    console.log(`🔍 Fetching token metadata for ${tokenAddress} from Moralis...`);
    
    try {
      const data = await this.makeRequest(`/erc20/metadata`, {
        addresses: [tokenAddress]
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
  async getNFTBalances(address: string): Promise<any[]> {
    console.log(`🖼️ Fetching NFT balances for ${address} from Moralis...`);
    
    try {
      const data = await this.makeRequest(`/${address}/nft`, {
        format: 'decimal',
        normalizeMetadata: true,
        exclude_spam: false
      });
      
      return data.result || [];
    } catch (error) {
      console.warn('Could not fetch NFT balances from Moralis');
      return [];
    }
  }

  /**
   * Get wallet's net worth
   */
  async getNetWorth(address: string): Promise<{ total_networth_usd: string; chains: any[] }> {
    console.log(`💎 Fetching net worth for ${address} from Moralis...`);
    
    try {
      const data = await this.makeRequest(`/${address}/net-worth`, {
        exclude_spam: true,
        exclude_unverified_contracts: true
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
  async getProfitAndLoss(address: string): Promise<any> {
    console.log(`📈 Fetching P&L for ${address} from Moralis...`);
    
    try {
      const data = await this.makeRequest(`/${address}/pnl`, {
        days: 30
      });
      
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
}

export default MoralisAPI;