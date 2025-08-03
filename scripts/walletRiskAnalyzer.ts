import dotenv from 'dotenv';
import ZerionAPI from './api/zerionAPI';
import MoralisAPI from './api/moralisAPI';
import DuneAPI from './api/duneAPI';
import DataManager from './data/dataManager';
import AssetAnalyzer from './analyseAssets';
import PoolAnalyzer from './analysePoolsGPT';
import FinalRiskAnalyzer from './finalRiskAnalyzer';

// Load environment variables
dotenv.config();

export interface WalletRiskAnalysisResult {
  address: string;
  analysis_complete: boolean;
  final_analysis?: {
    overall_risk_score: number;
    risk_level: 'very-low' | 'low' | 'medium' | 'high' | 'very-high';
    confidence_score: number;
    gpt_summary: string;
    key_risks: string[];
    recommendations: string[];
    alerts: Array<{
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
    }>;
  };
  individual_analyses: {
    assets?: {
      gpt_analysis: string;
      risk_score: number;
      key_findings: string[];
      recommendations: string[];
    };
    pools?: {
      gpt_analysis: string;
      risk_score: number;
      key_findings: string[];
      recommendations: string[];
    };
    protocols?: {
      gpt_analysis: string;
      risk_score: number;
      key_findings: string[];
      recommendations: string[];
    };
  };
  metadata: {
    analysis_version: string;
    last_updated: string;
    data_sources: string[];
    processing_time_ms?: number;
  };
}

export class WalletRiskAnalyzer {
  private dataManager: DataManager;
  private assetAnalyzer: AssetAnalyzer;
  private poolAnalyzer: PoolAnalyzer;
  private finalAnalyzer: FinalRiskAnalyzer;
  private zerionAPI: ZerionAPI;
  private moralisAPI: MoralisAPI;
  private duneAPI?: DuneAPI;

  constructor() {
    // Initialize data manager
    this.dataManager = new DataManager();

    // Get API keys from environment
    const zerionApiKey = process.env.ZERION_API_KEY;
    const moralisApiKey = process.env.MORALIS_API_KEY;
    const duneApiKey = process.env.DUNE_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!zerionApiKey || !moralisApiKey || !openaiApiKey) {
      throw new Error('Required API keys missing. Please check your environment variables.');
    }

    // Initialize API clients
    this.zerionAPI = new ZerionAPI(zerionApiKey);
    this.moralisAPI = new MoralisAPI(moralisApiKey);
    if (duneApiKey) {
      this.duneAPI = new DuneAPI(duneApiKey);
    }

    // Initialize analyzers
    this.assetAnalyzer = new AssetAnalyzer(zerionApiKey, moralisApiKey, openaiApiKey, this.dataManager);
    this.poolAnalyzer = new PoolAnalyzer(zerionApiKey, moralisApiKey, openaiApiKey, this.dataManager);
    this.finalAnalyzer = new FinalRiskAnalyzer(openaiApiKey, this.dataManager);
  }

  /**
   * Run complete wallet risk analysis
   */
  async analyzeWallet(
    address: string, 
    options: {
      forceRefresh?: boolean;
      maxAgeMinutes?: number;
      skipDune?: boolean;
    } = {}
  ): Promise<WalletRiskAnalysisResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Starting comprehensive wallet analysis for: ${address}`);

      // Validate address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        throw new Error('Invalid Ethereum address format');
      }

      // Check if we need to refresh data
      const existingData = await this.dataManager.loadWalletData(address);
      const shouldRefresh = options.forceRefresh || 
        this.dataManager.shouldRefreshData(existingData, options.maxAgeMinutes || 30);

      if (!shouldRefresh && existingData?.final_analysis) {
        console.log(`✅ Using cached analysis for ${address}`);
        return this.formatResult(existingData, Date.now() - startTime);
      }

      console.log(`🔄 Running fresh analysis for ${address}`);

      // Step 1: Fetch raw data from all sources
      await this.fetchAllRawData(address, options.skipDune);

      // Step 2: Run individual analyses in parallel
      const [assetAnalysis, poolAnalysis] = await Promise.all([
        this.runAssetAnalysis(address),
        this.runPoolAnalysis(address)
      ]);

      // Step 3: Run final combined analysis
      const finalAnalysis = await this.finalAnalyzer.generateFinalAnalysis(address);

      // Step 4: Load final data and format result
      const finalData = await this.dataManager.loadWalletData(address);
      const processingTime = Date.now() - startTime;

      console.log(`✅ Completed wallet analysis for ${address} in ${processingTime}ms`);

      return this.formatResult(finalData!, processingTime);

    } catch (error: any) {
      console.error(`❌ Error analyzing wallet ${address}:`, error.message);
      throw new Error(`Wallet analysis failed: ${error.message}`);
    }
  }

  /**
   * Fetch raw data from all available sources
   */
  private async fetchAllRawData(address: string, skipDune = false): Promise<void> {
    console.log(`📡 Fetching raw data from all sources...`);

    try {
      // Fetch from Zerion and Moralis in parallel
      const [zerionPortfolio, zerionPnL, moralisNetWorth, moralisTransactions] = await Promise.all([
        this.zerionAPI.getWalletPortfolio(address).catch(() => ({ totalValue: 0, positions: [], currency: 'usd' })),
        this.zerionAPI.getWalletPnL(address).catch(() => ({ total_pnl: 0, total_pnl_percentage: 0, realized_pnl: 0, unrealized_pnl: 0, currency: 'usd' })),
        this.moralisAPI.getNetWorth(address).catch(() => ({ total_networth_usd: '0', chains: [] })),
        this.moralisAPI.getTransactions(address, 50).catch(() => [])
      ]);

      // Store Zerion data
      await this.dataManager.updateRawData(address, 'zerion', {
        portfolio: zerionPortfolio,
        pnl: zerionPnL,
        transactions: []
      });

      // Store Moralis data
      await this.dataManager.updateRawData(address, 'moralis', {
        net_worth: moralisNetWorth,
        transactions: moralisTransactions,
        token_balances: [],
        native_balance: { balance: '0', balance_formatted: '0' },
        defi_positions: [],
        nfts: [],
        pnl: {}
      });

      // Fetch from Dune if available and not skipped
      if (this.duneAPI && !skipDune) {
        try {
          const duneMetrics = await this.duneAPI.getWalletMetrics(address);
          await this.dataManager.updateRawData(address, 'dune', {
            wallet_metrics: duneMetrics,
            dex_patterns: {},
            defi_interactions: {}
          });
        } catch (error) {
          console.warn('Could not fetch Dune data, continuing without it');
        }
      }

      console.log(`✅ Raw data fetching completed`);

    } catch (error: any) {
      console.error('Error fetching raw data:', error.message);
      // Continue with analysis even if some data sources fail
    }
  }

  /**
   * Run asset analysis
   */
  private async runAssetAnalysis(address: string) {
    console.log(`🪙 Running asset analysis...`);
    try {
      return await this.assetAnalyzer.analyzeWalletAssets(address);
    } catch (error: any) {
      console.error('Asset analysis failed:', error.message);
      // Store failed analysis
      await this.dataManager.updateAnalysis(address, 'assets', {
        gpt_analysis: 'Asset analysis failed due to data issues.',
        risk_score: 50,
        key_findings: ['Analysis incomplete'],
        recommendations: ['Re-run analysis when data sources are available']
      });
      return null;
    }
  }

  /**
   * Run pool analysis
   */
  private async runPoolAnalysis(address: string) {
    console.log(`🏊 Running pool analysis...`);
    try {
      return await this.poolAnalyzer.analyzeWalletPools(address);
    } catch (error: any) {
      console.error('Pool analysis failed:', error.message);
      // Store failed analysis
      await this.dataManager.updateAnalysis(address, 'pools', {
        gpt_analysis: 'Pool analysis failed due to data issues.',
        risk_score: 50,
        key_findings: ['Analysis incomplete'],
        recommendations: ['Re-run analysis when data sources are available']
      });
      return null;
    }
  }

  /**
   * Format the final result for API consumption
   */
  private formatResult(walletData: any, processingTime: number): WalletRiskAnalysisResult {
    const dataSources = Object.keys(walletData.raw_data);
    
    return {
      address: walletData.address,
      analysis_complete: !!walletData.final_analysis,
      final_analysis: walletData.final_analysis,
      individual_analyses: {
        assets: walletData.analysis.assets,
        pools: walletData.analysis.pools,
        protocols: walletData.analysis.protocols
      },
      metadata: {
        analysis_version: walletData.analysis_version || '2.0',
        last_updated: walletData.last_updated,
        data_sources: dataSources,
        processing_time_ms: processingTime
      }
    };
  }

  /**
   * Get analysis status for a wallet
   */
  async getAnalysisStatus(address: string): Promise<{
    exists: boolean;
    last_updated?: string;
    analyses_complete: string[];
    final_analysis_complete: boolean;
  }> {
    const walletData = await this.dataManager.loadWalletData(address);
    
    if (!walletData) {
      return {
        exists: false,
        analyses_complete: [],
        final_analysis_complete: false
      };
    }

    const completedAnalyses = Object.keys(walletData.analysis || {});
    
    return {
      exists: true,
      last_updated: walletData.last_updated,
      analyses_complete: completedAnalyses,
      final_analysis_complete: !!walletData.final_analysis
    };
  }

  /**
   * Delete wallet analysis data
   */
  async deleteWalletAnalysis(address: string): Promise<boolean> {
    return await this.dataManager.deleteWalletData(address);
  }

  /**
   * Get data statistics
   */
  async getDataStats() {
    return await this.dataManager.getDataStats();
  }
}

export default WalletRiskAnalyzer;