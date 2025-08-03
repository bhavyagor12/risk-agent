import axios from 'axios';

export interface ZerionPnLData {
  total_pnl: number;
  total_pnl_percentage: number;
  realized_pnl: number;
  unrealized_pnl: number;
  currency: string;
}

export interface ZerionTransaction {
  id: string;
  hash: string;
  block_number: number;
  timestamp: string;
  status: string;
  type: string;
  fee: number;
  from_address: string;
  to_address: string;
  value?: number;
  gas_used?: number;
  gas_price?: number;
  changes: Array<{
    asset: string;
    value: number;
    direction: 'in' | 'out';
    address_from?: string;
    address_to?: string;
  }>;
}

export interface ZerionPosition {
  type: 'token' | 'nft' | 'defi' | 'liquidity';
  asset: string;
  quantity: number;
  value: number;
  price?: number;
  protocol?: string;
  contractAddress?: string;
  tokens?: Array<{
    symbol: string;
    amount: number;
    value: number;
  }>;
}

export interface ZerionPortfolio {
  totalValue: number;
  positions: ZerionPosition[];
  currency: string;
}

export class ZerionAPI {
  private apiKey: string;
  private baseUrl = 'https://api.zerion.io/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, params: any = {}): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        params
      });
      return response.data;
    } catch (error: any) {
      console.error(`Zerion API error for ${endpoint}:`, error.response?.data || error.message);
      throw new Error(`Zerion API request failed: ${error.message}`);
    }
  }

  /**
   * Fetch wallet PnL data
   */
  async getWalletPnL(address: string, currency = 'usd'): Promise<ZerionPnLData> {
    console.log(`📊 Fetching PnL data for ${address} from Zerion...`);
    
    try {
      const data = await this.makeRequest(`/wallets/${address}/portfolio/stats`, {
        currency,
        'portfolio_fields': 'total_value,absolute_change_1d,relative_change_1d'
      });

      return {
        total_pnl: data.data?.absolute_change_1d || 0,
        total_pnl_percentage: data.data?.relative_change_1d || 0,
        realized_pnl: 0, // Would need historical data for this
        unrealized_pnl: data.data?.absolute_change_1d || 0,
        currency
      };
    } catch (error) {
      console.warn('Could not fetch PnL data from Zerion, using defaults');
      return {
        total_pnl: 0,
        total_pnl_percentage: 0,
        realized_pnl: 0,
        unrealized_pnl: 0,
        currency
      };
    }
  }

  /**
   * Fetch wallet portfolio positions
   */
  async getWalletPortfolio(address: string): Promise<ZerionPortfolio> {
    console.log(`💼 Fetching portfolio data for ${address} from Zerion...`);
    
    try {
      const data = await this.makeRequest(`/wallets/${address}/positions`, {
        'filter[position_types]': 'wallet,deposit,loan,liquidity,staked',
        'sort': '-value',
        'page[size]': 100
      });

      const positions: ZerionPosition[] = [];
      let totalValue = 0;

      if (data.data && Array.isArray(data.data)) {
        for (const item of data.data) {
          const attributes = item.attributes;
          const position: ZerionPosition = {
            type: this.categorizePosition(attributes),
            asset: attributes.fungible_info?.name || attributes.name || 'Unknown',
            quantity: parseFloat(attributes.quantity?.float) || 0,
            value: parseFloat(attributes.value) || 0,
            price: parseFloat(attributes.price) || undefined,
            protocol: attributes.protocol || undefined,
            contractAddress: attributes.fungible_info?.implementations?.[0]?.address
          };

          // Extract tokens for DeFi positions
          if (attributes.dapp_name || attributes.protocol) {
            position.tokens = this.extractTokensFromPosition(attributes);
          }

          positions.push(position);
          totalValue += position.value;
        }
      }

      return {
        totalValue,
        positions,
        currency: 'usd'
      };
    } catch (error) {
      console.warn('Could not fetch portfolio from Zerion, using empty portfolio');
      return {
        totalValue: 0,
        positions: [],
        currency: 'usd'
      };
    }
  }

  /**
   * Fetch transaction history
   */
  async getTransactionHistory(address: string, limit = 100): Promise<ZerionTransaction[]> {
    console.log(`📜 Fetching transaction history for ${address} from Zerion...`);
    
    try {
      const data = await this.makeRequest(`/wallets/${address}/transactions`, {
        'page[size]': limit,
        'sort': '-mined_at'
      });

      const transactions: ZerionTransaction[] = [];

      if (data.data && Array.isArray(data.data)) {
        for (const tx of data.data) {
          const attributes = tx.attributes;
          
          const transaction: ZerionTransaction = {
            id: tx.id,
            hash: attributes.hash,
            block_number: attributes.block_number || 0,
            timestamp: attributes.mined_at,
            status: attributes.status || 'confirmed',
            type: attributes.operation_type || 'unknown',
            fee: parseFloat(attributes.fee?.value) || 0,
            from_address: attributes.address_from || address,
            to_address: attributes.address_to || '',
            value: parseFloat(attributes.value) || 0,
            gas_used: attributes.gas_used,
            gas_price: attributes.gas_price,
            changes: this.extractChangesFromTransaction(attributes)
          };

          transactions.push(transaction);
        }
      }

      return transactions;
    } catch (error) {
      console.warn('Could not fetch transactions from Zerion, using empty array');
      return [];
    }
  }

  private categorizePosition(attributes: any): 'token' | 'nft' | 'defi' | 'liquidity' {
    if (attributes.type === 'nft') return 'nft';
    if (attributes.dapp_name || attributes.protocol) return 'defi';
    if (attributes.position_type === 'liquidity') return 'liquidity';
    return 'token';
  }

  private extractTokensFromPosition(attributes: any): Array<{ symbol: string; amount: number; value: number }> {
    const tokens: Array<{ symbol: string; amount: number; value: number }> = [];
    
    if (attributes.fungible_info) {
      tokens.push({
        symbol: attributes.fungible_info.symbol || 'UNKNOWN',
        amount: parseFloat(attributes.quantity?.float) || 0,
        value: parseFloat(attributes.value) || 0
      });
    }

    return tokens;
  }

  private extractChangesFromTransaction(attributes: any): Array<{
    asset: string;
    value: number;
    direction: 'in' | 'out';
    address_from?: string;
    address_to?: string;
  }> {
    const changes: Array<{
      asset: string;
      value: number;
      direction: 'in' | 'out';
      address_from?: string;
      address_to?: string;
    }> = [];

    if (attributes.changes && Array.isArray(attributes.changes)) {
      for (const change of attributes.changes) {
        changes.push({
          asset: change.asset?.symbol || 'ETH',
          value: parseFloat(change.value) || 0,
          direction: change.direction === 'out' ? 'out' : 'in',
          address_from: change.address_from,
          address_to: change.address_to
        });
      }
    }

    return changes;
  }
}

export default ZerionAPI;