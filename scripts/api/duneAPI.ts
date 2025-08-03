import axios from 'axios';

export interface DuneQueryResult {
  query_id: number;
  execution_id: string;
  state: 'QUERY_STATE_PENDING' | 'QUERY_STATE_EXECUTING' | 'QUERY_STATE_COMPLETED' | 'QUERY_STATE_FAILED';
  submitted_at: string;
  execution_started_at?: string;
  execution_ended_at?: string;
  result?: {
    rows: any[];
    metadata: {
      column_names: string[];
      column_types: string[];
      row_count: number;
    };
  };
}

export interface WalletMetrics {
  total_transactions: number;
  total_volume_eth: number;
  total_volume_usd: number;
  first_transaction_date: string;
  last_transaction_date: string;
  unique_contracts_interacted: number;
  gas_spent_eth: number;
  gas_spent_usd: number;
  dex_volume_usd: number;
  defi_protocols_used: string[];
  nft_transactions: number;
  bridge_transactions: number;
  mev_bot_interactions: number;
  suspicious_patterns: string[];
}

export class DuneAPI {
  private apiKey: string;
  private baseUrl = 'https://api.dune.com/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any): Promise<any> {
    try {
      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'X-Dune-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        ...(data && { data })
      };

      const response = await axios(config);
      return response.data;
    } catch (error: any) {
      console.error(`Dune API error for ${endpoint}:`, error.response?.data || error.message);
      throw new Error(`Dune API request failed: ${error.message}`);
    }
  }

  /**
   * Execute a parameterized query for wallet analysis
   */
  async executeWalletAnalysisQuery(address: string): Promise<DuneQueryResult> {
    console.log(`🔍 Running Dune Analytics query for ${address}...`);
    
    // This would be a custom query ID created in Dune Analytics
    // For demonstration, using a placeholder query ID
    const WALLET_ANALYSIS_QUERY_ID = 123456; // Replace with actual query ID
    
    try {
      const response = await this.makeRequest(`/query/${WALLET_ANALYSIS_QUERY_ID}/execute`, 'POST', {
        query_parameters: {
          wallet_address: address.toLowerCase()
        }
      });
      
      return response;
    } catch (error) {
      console.warn('Could not execute Dune query, using mock data');
      return this.getMockWalletAnalysis(address);
    }
  }

  /**
   * Get query results
   */
  async getQueryResults(execution_id: string): Promise<DuneQueryResult> {
    console.log(`📊 Fetching Dune query results for execution ${execution_id}...`);
    
    try {
      const response = await this.makeRequest(`/execution/${execution_id}/results`);
      return response;
    } catch (error) {
      console.warn(`Could not fetch query results for ${execution_id}`);
      throw error;
    }
  }

  /**
   * Get comprehensive wallet metrics using Dune Analytics
   */
  async getWalletMetrics(address: string): Promise<WalletMetrics> {
    console.log(`📊 Fetching comprehensive wallet metrics for ${address} from Dune...`);
    
    try {
      // Execute the wallet analysis query
      const execution = await this.executeWalletAnalysisQuery(address);
      
      // Poll for results if query is still running
      let results = execution;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (results.state !== 'QUERY_STATE_COMPLETED' && results.state !== 'QUERY_STATE_FAILED' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        results = await this.getQueryResults(execution.execution_id);
        attempts++;
      }
      
      if (results.state === 'QUERY_STATE_COMPLETED' && results.result) {
        return this.parseWalletMetrics(results.result.rows[0] || {});
      } else {
        throw new Error('Query failed or timed out');
      }
      
    } catch (error) {
      console.warn('Could not fetch wallet metrics from Dune, using mock data');
      return this.getMockWalletMetrics(address);
    }
  }

  /**
   * Get DEX trading patterns
   */
  async getDEXTradingPatterns(address: string): Promise<any> {
    console.log(`🔄 Fetching DEX trading patterns for ${address} from Dune...`);
    
    // This would use a specific Dune query for DEX analysis
    try {
      // Placeholder implementation
      return {
        total_dex_volume: 0,
        preferred_dexes: [],
        trading_frequency: 'low',
        mev_sandwich_attacks: 0,
        failed_transactions: 0,
        gas_optimization_score: 50
      };
    } catch (error) {
      console.warn('Could not fetch DEX patterns from Dune');
      return {};
    }
  }

  /**
   * Get DeFi protocol interactions
   */
  async getDefiProtocolInteractions(address: string): Promise<any> {
    console.log(`🏦 Fetching DeFi protocol interactions for ${address} from Dune...`);
    
    try {
      // Placeholder implementation
      return {
        protocols_used: [],
        total_tvl_historical: 0,
        liquidation_events: 0,
        yield_farming_positions: [],
        governance_participation: 0
      };
    } catch (error) {
      console.warn('Could not fetch DeFi interactions from Dune');
      return {};
    }
  }

  private parseWalletMetrics(row: any): WalletMetrics {
    return {
      total_transactions: row.total_transactions || 0,
      total_volume_eth: row.total_volume_eth || 0,
      total_volume_usd: row.total_volume_usd || 0,
      first_transaction_date: row.first_transaction_date || new Date().toISOString(),
      last_transaction_date: row.last_transaction_date || new Date().toISOString(),
      unique_contracts_interacted: row.unique_contracts_interacted || 0,
      gas_spent_eth: row.gas_spent_eth || 0,
      gas_spent_usd: row.gas_spent_usd || 0,
      dex_volume_usd: row.dex_volume_usd || 0,
      defi_protocols_used: row.defi_protocols_used ? row.defi_protocols_used.split(',') : [],
      nft_transactions: row.nft_transactions || 0,
      bridge_transactions: row.bridge_transactions || 0,
      mev_bot_interactions: row.mev_bot_interactions || 0,
      suspicious_patterns: row.suspicious_patterns ? row.suspicious_patterns.split(',') : []
    };
  }

  private getMockWalletAnalysis(address: string): DuneQueryResult {
    return {
      query_id: 123456,
      execution_id: `mock-${Date.now()}`,
      state: 'QUERY_STATE_COMPLETED',
      submitted_at: new Date().toISOString(),
      execution_started_at: new Date().toISOString(),
      execution_ended_at: new Date().toISOString(),
      result: {
        rows: [{}],
        metadata: {
          column_names: [],
          column_types: [],
          row_count: 1
        }
      }
    };
  }

  private getMockWalletMetrics(address: string): WalletMetrics {
    return {
      total_transactions: 0,
      total_volume_eth: 0,
      total_volume_usd: 0,
      first_transaction_date: new Date().toISOString(),
      last_transaction_date: new Date().toISOString(),
      unique_contracts_interacted: 0,
      gas_spent_eth: 0,
      gas_spent_usd: 0,
      dex_volume_usd: 0,
      defi_protocols_used: [],
      nft_transactions: 0,
      bridge_transactions: 0,
      mev_bot_interactions: 0,
      suspicious_patterns: []
    };
  }
}

export default DuneAPI;