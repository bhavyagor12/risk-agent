import fs from 'fs';
import path from 'path';

export interface WalletAnalysisData {
  address: string;
  last_updated: string;
  analysis_version: string;
  
  // Raw API Data
  raw_data: {
    zerion?: {
      pnl: any;
      portfolio: any;
      transactions: any[];
    };
    moralis?: {
      native_balance: any;
      token_balances: any[];
      transactions: any[];
      defi_positions: any[];
      nfts: any[];
      net_worth: any;
      pnl: any;
    };
    dune?: {
      wallet_metrics: any;
      dex_patterns: any;
      defi_interactions: any;
    };
  };
  
  // Analysis Results
  analysis: {
    assets?: {
      gpt_analysis: string;
      risk_score: number;
      key_findings: string[];
      recommendations: string[];
      processed_at: string;
    };
    pools?: {
      gpt_analysis: string;
      risk_score: number;
      key_findings: string[];
      recommendations: string[];
      processed_at: string;
    };
    protocols?: {
      gpt_analysis: string;
      risk_score: number;
      key_findings: string[];
      recommendations: string[];
      processed_at: string;
    };
  };
  
  // Final Combined Analysis
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
    processed_at: string;
  };
}

export class DataManager {
  private dataDir: string;

  constructor(dataDir = './public/data/wallets') {
    this.dataDir = path.resolve(dataDir);
    this.ensureDataDirectory();
  }

  /**
   * Ensure data directory exists
   */
  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      console.log(`📁 Created data directory: ${this.dataDir}`);
    }
  }

  /**
   * Get file path for wallet address
   */
  private getWalletFilePath(address: string): string {
    const sanitizedAddress = address.toLowerCase().replace(/[^a-z0-9]/g, '');
    return path.join(this.dataDir, `${sanitizedAddress}.json`);
  }

  /**
   * Load wallet data from file
   */
  async loadWalletData(address: string): Promise<WalletAnalysisData | null> {
    const filePath = this.getWalletFilePath(address);
    
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`📄 No existing data file for ${address}`);
        return null;
      }

      const data = fs.readFileSync(filePath, 'utf-8');
      const walletData = JSON.parse(data) as WalletAnalysisData;
      
      console.log(`📖 Loaded existing data for ${address} (last updated: ${walletData.last_updated})`);
      return walletData;
    } catch (error) {
      console.error(`Error loading wallet data for ${address}:`, error);
      return null;
    }
  }

  /**
   * Save wallet data to file
   */
  async saveWalletData(data: WalletAnalysisData): Promise<void> {
    const filePath = this.getWalletFilePath(data.address);
    
    try {
      // Update timestamp
      data.last_updated = new Date().toISOString();
      
      // Write to file with pretty formatting
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      
      console.log(`💾 Saved wallet data for ${data.address} to ${filePath}`);
    } catch (error) {
      console.error(`Error saving wallet data for ${data.address}:`, error);
      throw error;
    }
  }

  /**
   * Initialize new wallet data structure
   */
  createNewWalletData(address: string): WalletAnalysisData {
    return {
      address: address.toLowerCase(),
      last_updated: new Date().toISOString(),
      analysis_version: '2.0',
      raw_data: {},
      analysis: {}
    };
  }

  /**
   * Update raw API data
   */
  async updateRawData(
    address: string, 
    source: 'zerion' | 'moralis' | 'dune', 
    data: any
  ): Promise<WalletAnalysisData> {
    let walletData = await this.loadWalletData(address);
    
    if (!walletData) {
      walletData = this.createNewWalletData(address);
    }

    // Ensure raw_data structure exists
    if (!walletData.raw_data) {
      walletData.raw_data = {};
    }

    // Update the specific source data
    walletData.raw_data[source] = data;
    
    await this.saveWalletData(walletData);
    return walletData;
  }

  /**
   * Update analysis results
   */
  async updateAnalysis(
    address: string,
    analysisType: 'assets' | 'pools' | 'protocols',
    analysis: {
      gpt_analysis: string;
      risk_score: number;
      key_findings: string[];
      recommendations: string[];
    }
  ): Promise<WalletAnalysisData> {
    let walletData = await this.loadWalletData(address);
    
    if (!walletData) {
      walletData = this.createNewWalletData(address);
    }

    // Ensure analysis structure exists
    if (!walletData.analysis) {
      walletData.analysis = {};
    }

    // Update the specific analysis
    walletData.analysis[analysisType] = {
      ...analysis,
      processed_at: new Date().toISOString()
    };
    
    await this.saveWalletData(walletData);
    return walletData;
  }

  /**
   * Update final combined analysis
   */
  async updateFinalAnalysis(
    address: string,
    finalAnalysis: {
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
    }
  ): Promise<WalletAnalysisData> {
    let walletData = await this.loadWalletData(address);
    
    if (!walletData) {
      walletData = this.createNewWalletData(address);
    }

    walletData.final_analysis = {
      ...finalAnalysis,
      processed_at: new Date().toISOString()
    };
    
    await this.saveWalletData(walletData);
    return walletData;
  }

  /**
   * Check if data needs refresh (older than specified minutes)
   */
  shouldRefreshData(walletData: WalletAnalysisData | null, maxAgeMinutes = 30): boolean {
    if (!walletData) return true;
    
    const lastUpdated = new Date(walletData.last_updated);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastUpdated.getTime()) / (1000 * 60);
    
    return diffMinutes > maxAgeMinutes;
  }

  /**
   * Get all wallet addresses that have been analyzed
   */
  async getAllAnalyzedWallets(): Promise<string[]> {
    try {
      const files = fs.readdirSync(this.dataDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch (error) {
      console.error('Error reading wallet directory:', error);
      return [];
    }
  }

  /**
   * Delete wallet data file
   */
  async deleteWalletData(address: string): Promise<boolean> {
    const filePath = this.getWalletFilePath(address);
    
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted wallet data for ${address}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error deleting wallet data for ${address}:`, error);
      return false;
    }
  }

  /**
   * Get data directory stats
   */
  async getDataStats(): Promise<{
    total_wallets: number;
    total_size_mb: number;
    oldest_analysis: string | null;
    newest_analysis: string | null;
  }> {
    try {
      const files = fs.readdirSync(this.dataDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      let totalSize = 0;
      let oldestDate: Date | null = null;
      let newestDate: Date | null = null;
      
      for (const file of jsonFiles) {
        const filePath = path.join(this.dataDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
        
        if (!oldestDate || stats.mtime < oldestDate) {
          oldestDate = stats.mtime;
        }
        if (!newestDate || stats.mtime > newestDate) {
          newestDate = stats.mtime;
        }
      }
      
      return {
        total_wallets: jsonFiles.length,
        total_size_mb: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
        oldest_analysis: oldestDate?.toISOString() || null,
        newest_analysis: newestDate?.toISOString() || null
      };
    } catch (error) {
      console.error('Error getting data stats:', error);
      return {
        total_wallets: 0,
        total_size_mb: 0,
        oldest_analysis: null,
        newest_analysis: null
      };
    }
  }
}

export default DataManager;