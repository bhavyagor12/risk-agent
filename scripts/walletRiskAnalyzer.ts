import dotenv from 'dotenv';
import MoralisAPI from './api/moralisAPI';
import DataManager from './data/dataManager';
import AssetAnalyzer from './analyseAssets';
import PoolAnalyzer from './analysePoolsGPT';
import ProtocolAnalyzer from './analyseProtocols';
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
    multiChainInfo?: {
      totalChainsActive: number;
      chainsWithActivity: string[];
      crossChainRisks: string[];
      chainSpecificRisks: { [chain: string]: string[] };
    };
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
  multiChainData?: {
    totalNetWorth: number;
    chainsActive: number;
    chainBreakdown: {
      [chain: string]: {
        netWorth: number;
        tokenCount: number;
        nativeBalance: string;
        defiPositions: number;
        hasActivity: boolean;
      };
    };
    crossChainExposure: boolean;
    tradingPerformance?: {
      totalTrades: number;
      realizedProfitUsd: number;
      realizedProfitPercentage: number;
    };
  };
  metadata: {
    analysis_version: string;
    last_updated: string;
    data_sources: string[];
    processing_time_ms?: number;
    moralis_chains_analyzed: string[];
  };
}

export class WalletRiskAnalyzer {
  private dataManager: DataManager;
  private assetAnalyzer: AssetAnalyzer;
  private poolAnalyzer: PoolAnalyzer;
  private protocolAnalyzer: ProtocolAnalyzer;
  private finalAnalyzer: FinalRiskAnalyzer;
  private moralisAPI: MoralisAPI;

  constructor() {
    // Initialize data manager
    this.dataManager = new DataManager();

    // Get API keys from environment
    const moralisApiKey = process.env.MORALIS_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_SECRET;
    const serpApiKey = process.env.SERP_API_KEY;

    if (!moralisApiKey || !openaiApiKey || !serpApiKey) {
      throw new Error('Required API keys missing. Please check your environment variables (MORALIS_API_KEY, OPENAI_API_SECRET, SERP_API_KEY).');
    }

    // Initialize API clients
    this.moralisAPI = new MoralisAPI(moralisApiKey);

    // Initialize analyzers (Moralis-only)
    this.assetAnalyzer = new AssetAnalyzer(moralisApiKey, openaiApiKey, serpApiKey, this.dataManager);
    this.poolAnalyzer = new PoolAnalyzer(moralisApiKey, openaiApiKey, this.dataManager);
    this.protocolAnalyzer = new ProtocolAnalyzer(openaiApiKey, serpApiKey, this.dataManager);
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
      await this.fetchAllRawData(address);

      // Step 2: Load the fetched data and run individual analyses in parallel
      const walletData = await this.dataManager.loadWalletData(address);
      const [assetAnalysis, poolAnalysis, protocolAnalysis] = await Promise.all([
        this.runAssetAnalysis(address, walletData),
        this.runPoolAnalysis(address, walletData),
        this.runProtocolAnalysis(address, walletData)
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
   * Fetch raw multi-chain data from Moralis only
   */
  private async fetchAllRawData(address: string): Promise<void> {
    console.log(`📡 Fetching multi-chain data from Moralis...`);

    try {
      // Fetch comprehensive multi-chain data from Moralis in parallel
      const [
        // Ethereum data
        ethPortfolio, ethTransactions, ethTokenBalances, ethNativeBalance, ethDefiPositions, ethProfitLoss,
        // Base data
        baseTokenBalances, baseNativeBalance, baseDefiPositions,
        // Polygon data
        polygonTokenBalances, polygonNativeBalance, polygonDefiPositions
      ] = await Promise.all([
        // Ethereum
        this.moralisAPI.getWalletPortfolio(address, 'eth').catch(() => ({ totalValue: 0, nativeBalance: { balance: '0', balance_formatted: '0' }, tokenBalances: [], nftBalances: [], defiPositions: [], netWorth: { total_networth_usd: '0', chains: [] }, profitLoss: {} })),
        this.moralisAPI.getTransactions(address, 'eth', 100).catch(() => []),
        this.moralisAPI.getTokenBalances(address, 'eth').catch(() => []),
        this.moralisAPI.getNativeBalance(address, 'eth').catch(() => ({ balance: '0', balance_formatted: '0' })),
        this.moralisAPI.getDefiPositions(address, 'eth').catch(() => []),
        this.moralisAPI.getProfitAndLoss(address, 'eth').catch(() => ({})),
        // Base
        this.moralisAPI.getTokenBalances(address, 'base').catch(() => []),
        this.moralisAPI.getNativeBalance(address, 'base').catch(() => ({ balance: '0', balance_formatted: '0' })),
        this.moralisAPI.getDefiPositions(address, 'base').catch(() => []),
        // Polygon
        this.moralisAPI.getTokenBalances(address, 'polygon').catch(() => []),
        this.moralisAPI.getNativeBalance(address, 'polygon').catch(() => ({ balance: '0', balance_formatted: '0' })),
        this.moralisAPI.getDefiPositions(address, 'polygon').catch(() => [])
      ]);

      // Use net worth data from ethPortfolio instead of making a separate call
      const multiChainNetWorth = ethPortfolio.netWorth;

      // Extract chain-specific net worth data from multi-chain response
      const ethNetWorth = {
        total_networth_usd: multiChainNetWorth.total_networth_usd,
        chains: multiChainNetWorth.chains?.filter((chain: any) => chain.chain === 'eth' || chain.chain === 'ethereum') || []
      };
      
      const baseNetWorth = {
        total_networth_usd: multiChainNetWorth.total_networth_usd,
        chains: multiChainNetWorth.chains?.filter((chain: any) => chain.chain === 'base') || []
      };
      
      const polygonNetWorth = {
        total_networth_usd: multiChainNetWorth.total_networth_usd,
        chains: multiChainNetWorth.chains?.filter((chain: any) => chain.chain === 'polygon') || []
      };

      // Calculate combined metrics
      const totalNetWorth = parseFloat(multiChainNetWorth.total_networth_usd || '0');

      // Store ALL raw Moralis data without type filtering
      await this.dataManager.updateRawData(address, 'moralis', {
        // Store all raw API responses directly
        raw_ethereum_portfolio: ethPortfolio,
        raw_ethereum_transactions: ethTransactions,
        raw_ethereum_token_balances: ethTokenBalances,
        raw_ethereum_native_balance: ethNativeBalance,
        raw_ethereum_defi_positions: ethDefiPositions,
        raw_ethereum_profit_loss: ethProfitLoss,
        raw_base_token_balances: baseTokenBalances,
        raw_base_native_balance: baseNativeBalance,
        raw_base_defi_positions: baseDefiPositions,
        raw_polygon_token_balances: polygonTokenBalances,
        raw_polygon_native_balance: polygonNativeBalance,
        raw_polygon_defi_positions: polygonDefiPositions,
        raw_multi_chain_net_worth: multiChainNetWorth,
        
        // Keep backward compatibility structure too
        ethereum: {
          portfolio: ethPortfolio,
          net_worth: ethNetWorth,
          transactions: ethTransactions,
          token_balances: ethTokenBalances,
          native_balance: ethNativeBalance,
          defi_positions: ethDefiPositions,
          profit_loss: ethProfitLoss
        },
        base: {
          net_worth: baseNetWorth,
          token_balances: baseTokenBalances,
          native_balance: baseNativeBalance,
          defi_positions: baseDefiPositions
        },
        polygon: {
          net_worth: polygonNetWorth,
          token_balances: polygonTokenBalances,
          native_balance: polygonNativeBalance,
          defi_positions: polygonDefiPositions
        },
        combined_metrics: {
          total_net_worth_usd: totalNetWorth,
          total_chains_active: [
            (ethTokenBalances as any)?.result?.length > 0 || parseFloat(ethNativeBalance?.balance_formatted || '0') > 0 ? 'ethereum' : null,
            (baseTokenBalances as any)?.result?.length > 0 || parseFloat(baseNativeBalance?.balance_formatted || '0') > 0 ? 'base' : null,
            (polygonTokenBalances as any)?.result?.length > 0 || parseFloat(polygonNativeBalance?.balance_formatted || '0') > 0 ? 'polygon' : null
          ].filter(Boolean).length,
          chains_with_activity: [
            (ethTokenBalances as any)?.result?.length > 0 || parseFloat(ethNativeBalance?.balance_formatted || '0') > 0 ? 'ethereum' : null,
            (baseTokenBalances as any)?.result?.length > 0 || parseFloat(baseNativeBalance?.balance_formatted || '0') > 0 ? 'base' : null,
            (polygonTokenBalances as any)?.result?.length > 0 || parseFloat(polygonNativeBalance?.balance_formatted || '0') > 0 ? 'polygon' : null
          ].filter(Boolean)
        }
      });

      console.log(`✅ Multi-chain raw data fetching completed`);

    } catch (error: any) {
      console.error('Error fetching multi-chain raw data:', error.message);
      // Continue with analysis even if some data sources fail
    }
  }

  /**
   * Run asset analysis with pre-fetched data
   */
  private async runAssetAnalysis(address: string, walletData?: any) {
    console.log(`🪙 Running asset analysis...`);
    try {
      return await this.assetAnalyzer.analyzeWalletAssets(address, walletData);
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
   * Run pool analysis with pre-fetched data
   */
  private async runPoolAnalysis(address: string, walletData?: any) {
    console.log(`🏊 Running pool analysis...`);
    try {
      return await this.poolAnalyzer.analyzeWalletPools(address, walletData);
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
   * Run protocol analysis with pre-fetched data
   */
  private async runProtocolAnalysis(address: string, walletData?: any) {
    console.log(`🏗️ Running protocol analysis...`);
    try {
      return await this.protocolAnalyzer.analyzeWalletProtocols(address, walletData);
    } catch (error: any) {
      console.error('Protocol analysis failed:', error.message);
      // Store failed analysis
      await this.dataManager.updateAnalysis(address, 'protocols', {
        gpt_analysis: 'Protocol analysis failed due to data issues.',
        risk_score: 50,
        key_findings: ['Analysis incomplete'],
        recommendations: ['Re-run analysis when data sources are available']
      });
      return null;
    }
  }

  /**
   * Format the final result for API consumption with multi-chain support
   */
  private formatResult(walletData: any, processingTime: number): WalletRiskAnalysisResult {
    const dataSources = Object.keys(walletData.raw_data);
    const moralisChainsAnalyzed: string[] = [];
    
    // Extract multi-chain data if available
    let multiChainData = undefined;
    if (walletData.raw_data.moralis) {
      const moralisData = walletData.raw_data.moralis;
      const chainBreakdown: { [chain: string]: any } = {};
      
      const chains = ['ethereum', 'base', 'polygon'];
      for (const chain of chains) {
        const chainData = moralisData[chain];
        if (chainData) {
          // Handle both old and new flexible data structures
          const tokenBalances = chainData.token_balances?.result || chainData.token_balances || [];
          const nativeBalance = chainData.native_balance || {};
          const defiPositions = chainData.defi_positions?.result || chainData.defi_positions || [];
          
          const hasActivity = (tokenBalances.length > 0) || 
                             (parseFloat(nativeBalance.balance_formatted || '0') > 0);
          
          if (hasActivity) {
            moralisChainsAnalyzed.push(chain);
            chainBreakdown[chain] = {
              netWorth: parseFloat(chainData.net_worth?.total_networth_usd || '0'),
              tokenCount: tokenBalances.length || 0,
              nativeBalance: nativeBalance.balance_formatted || '0',
              defiPositions: defiPositions.length || 0,
              hasActivity: true
            };
          }
        }
      }

      if (Object.keys(chainBreakdown).length > 0) {
        multiChainData = {
          totalNetWorth: moralisData.combined_metrics?.total_net_worth_usd || 0,
          chainsActive: moralisData.combined_metrics?.total_chains_active || 0,
          chainBreakdown,
          crossChainExposure: Object.keys(chainBreakdown).length > 1,
          tradingPerformance: moralisData.ethereum?.profit_loss ? {
            totalTrades: moralisData.ethereum.profit_loss.total_count_of_trades || 0,
            realizedProfitUsd: parseFloat(moralisData.ethereum.profit_loss.total_realized_profit_usd || '0'),
            realizedProfitPercentage: moralisData.ethereum.profit_loss.total_realized_profit_percentage || 0
          } : undefined
        };
      }
    }
    
    return {
      address: walletData.address,
      analysis_complete: !!walletData.final_analysis,
      final_analysis: walletData.final_analysis,
      individual_analyses: {
        assets: walletData.analysis.assets,
        pools: walletData.analysis.pools,
        protocols: walletData.analysis.protocols
      },
      multiChainData,
      metadata: {
        analysis_version: walletData.analysis_version || '3.0-multichain',
        last_updated: walletData.last_updated,
        data_sources: dataSources,
        processing_time_ms: processingTime,
        moralis_chains_analyzed: moralisChainsAnalyzed
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