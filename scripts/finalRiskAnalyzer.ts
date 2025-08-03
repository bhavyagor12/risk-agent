import { OpenAI } from 'openai';
import DataManager, { WalletAnalysisData } from './data/dataManager';

export interface FinalRiskAnalysis {
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
}

export class FinalRiskAnalyzer {
  private openai: OpenAI;
  private dataManager: DataManager;

  // Risk level thresholds
  private riskLevels = {
    'very-low': { min: 0, max: 20, description: 'Very Low Risk - Safe for conservative investors' },
    'low': { min: 21, max: 40, description: 'Low Risk - Generally safe with minimal concerns' },
    'medium': { min: 41, max: 60, description: 'Medium Risk - Some concerns, requires monitoring' },
    'high': { min: 61, max: 80, description: 'High Risk - Significant concerns, immediate attention needed' },
    'very-high': { min: 81, max: 100, description: 'Very High Risk - Dangerous, immediate action required' }
  };

  constructor(openaiApiKey: string, dataManager: DataManager) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.dataManager = dataManager;
  }

  /**
   * Generate final comprehensive risk analysis
   */
  async generateFinalAnalysis(address: string): Promise<FinalRiskAnalysis> {
    try {
      console.log(`🎯 Generating final risk analysis for wallet: ${address}`);

      // Load all analysis data
      const walletData = await this.dataManager.loadWalletData(address);
      if (!walletData) {
        throw new Error('No wallet data found. Run individual analyses first.');
      }

      // Check if we have all required analyses
      const requiredAnalyses = ['assets', 'pools', 'protocols'];
      const missingAnalyses = requiredAnalyses.filter(analysis => !walletData.analysis[analysis as keyof typeof walletData.analysis]);
      
      if (missingAnalyses.length > 0) {
        console.warn(`Missing analyses: ${missingAnalyses.join(', ')}. Proceeding with available data.`);
      }

      // Generate GPT-powered final analysis
      const finalAnalysis = await this.generateGPTFinalAnalysis(walletData);

      // Store final analysis
      await this.dataManager.updateFinalAnalysis(address, finalAnalysis);

      return finalAnalysis;

    } catch (error: any) {
      console.error('Final analysis error:', error.message);
      throw new Error(`Failed to generate final analysis: ${error.message}`);
    }
  }

  /**
   * Generate GPT-powered final analysis
   */
  private async generateGPTFinalAnalysis(walletData: WalletAnalysisData): Promise<FinalRiskAnalysis> {
    try {
      const prompt = this.buildFinalAnalysisPrompt(walletData);

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `<role>
You are a senior cryptocurrency risk analyst providing a final comprehensive risk assessment. 
Synthesize all available data to provide an authoritative risk evaluation.
</role>

<analysis_framework>
<risk_scoring>
<level range="0-20" category="very_low">Conservative, established assets, good practices</level>
<level range="21-40" category="low">Generally safe with minor concerns</level>
<level range="41-60" category="medium">Mixed signals, requires monitoring</level>
<level range="61-80" category="high">Significant concerns, immediate attention needed</level>
<level range="81-100" category="very_high">Dangerous patterns, urgent action required</level>
</risk_scoring>

<confidence_scoring>
<level range="90-100" category="very_high">Comprehensive data, clear patterns</level>
<level range="70-89" category="high">Good data coverage, consistent signals</level>
<level range="50-69" category="medium">Some gaps in data, mixed signals</level>
<level range="30-49" category="low">Limited data, uncertain patterns</level>
<level range="0-29" category="very_low">Insufficient data for reliable assessment</level>
</confidence_scoring>

<analysis_dimensions>
<dimension name="asset_quality">Token legitimacy, diversification, concentration risks</dimension>
<dimension name="defi_exposure">Protocol risks, smart contract exposure, IL risks</dimension>
<dimension name="behavioral_patterns">Transaction patterns, interaction with risky protocols</dimension>
<dimension name="portfolio_construction">Balance, risk management, strategy coherence</dimension>
<dimension name="security_indicators">Suspicious activity, potential vulnerabilities</dimension>
</analysis_dimensions>
</analysis_framework>

<examples>
<example>
<scenario>
Asset Analysis: 15/100 risk (70% stablecoins, 30% ETH/BTC)
Pool Analysis: 0/100 risk (no DeFi positions)
Protocols: N/A
Portfolio Value: $50k
</scenario>
<expected_overall_risk>12</expected_overall_risk>
<expected_confidence>85</expected_confidence>
<expected_summary>Extremely conservative portfolio with minimal risk exposure</expected_summary>
<expected_alerts>[]</expected_alerts>
</example>

<example>
<scenario>
Asset Analysis: 85/100 risk (multiple potential scam tokens)
Pool Analysis: 90/100 risk (unknown protocols, 300% APY)
Protocols: 75/100 risk (interaction with flagged contracts)
Portfolio Value: $200k
</scenario>
<expected_overall_risk>88</expected_overall_risk>
<expected_confidence>95</expected_confidence>
<expected_summary>Extremely high-risk portfolio with multiple red flags requiring immediate action</expected_summary>
<expected_alerts>[{"severity": "critical", "message": "Multiple scam indicators detected"}]</expected_alerts>
</example>

<example>
<scenario>
Asset Analysis: 25/100 risk (diversified blue chips)
Pool Analysis: 35/100 risk (Uniswap, Aave positions)
Protocols: 30/100 risk (established DeFi usage)
Portfolio Value: $125k
</scenario>
<expected_overall_risk>28</expected_overall_risk>
<expected_confidence>90</expected_confidence>
<expected_summary>Well-managed portfolio with established assets and protocols</expected_summary>
<expected_alerts>[]</expected_alerts>
</example>
</examples>

<priority_focus>
<priority level="1">Most critical risks that need immediate attention</priority>
<priority level="2">Overall portfolio risk considering all dimensions</priority>
<priority level="3">Actionable recommendations for risk mitigation</priority>
<priority level="4">Confidence level based on data quality and consistency</priority>
</priority_focus>

<output_format>
CRITICAL: You must respond with valid JSON only. Do not include any text before or after the JSON.
{
  "overall_risk_score": number (0-100),
  "risk_level": "very-low|low|medium|high|very-high",
  "confidence_score": number (0-100),
  "gpt_summary": "comprehensive summary of wallet risk profile",
  "key_risks": ["risk1", "risk2", "risk3", ...],
  "recommendations": ["rec1", "rec2", "rec3", ...],
  "alerts": [
    {"severity": "low|medium|high|critical", "message": "alert message"},
    ...
  ],
  "multiChainInfo": {
    "totalChainsActive": number,
    "chainsWithActivity": ["chain1", "chain2", ...],
    "crossChainRisks": ["risk1", "risk2", ...],
    "chainSpecificRisks": {
      "ethereum: ["eth_risk1", "eth_risk2"],
      "base": ["base_risk1"],
      "polygon": ["polygon_risk1"]
    }
  }
}
</output_format>`
          },
          {
            role: "user",
            content: prompt
          }
        ],

        temperature: 0.2,
        max_tokens: 2000
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from GPT');
      }

      // Parse the JSON response
      const analysis = JSON.parse(response);

      // Validate and normalize the response
      return this.validateAndNormalizeFinalAnalysis(analysis);

    } catch (error: any) {
      console.error('GPT final analysis error:', error.message);
      return this.generateFallbackFinalAnalysis(walletData);
    }
  }

  /**
   * Build comprehensive prompt for final analysis
   */
  private buildFinalAnalysisPrompt(walletData: WalletAnalysisData): string {
    let prompt = `COMPREHENSIVE WALLET RISK ANALYSIS

WALLET: ${walletData.address}
ANALYSIS DATE: ${walletData.last_updated}
DATA SOURCES: ${Object.keys(walletData.raw_data).join(', ').toUpperCase()}

`;

    // Multi-Chain Portfolio Overview - handle flexible data structure
    const moralisData = walletData.raw_data.moralis as any;
    
    // Get net worth from either raw data or processed data
    const netWorthData = moralisData?.raw_multi_chain_net_worth || moralisData?.combined_metrics;
    const portfolioData = moralisData?.raw_ethereum_portfolio || moralisData?.ethereum?.portfolio;
    const profitLossData = moralisData?.raw_ethereum_profit_loss || moralisData?.ethereum?.profit_loss;
    
    if (netWorthData) {
      const totalNetWorth = netWorthData.total_networth_usd || netWorthData.total_net_worth_usd;
      const chainsActive = netWorthData.total_chains_active || 0;
      const chainsWithActivity = netWorthData.chains_with_activity || [];
      
      prompt += `MULTI-CHAIN PORTFOLIO OVERVIEW:
- Total Net Worth: $${parseFloat(totalNetWorth || '0').toLocaleString()}
- Active Chains: ${chainsActive} (${Array.isArray(chainsWithActivity) ? chainsWithActivity.join(', ') : 'None'})
- Ethereum Portfolio Value: $${parseFloat(portfolioData?.totalValue || '0').toLocaleString()}`;

      // Add P&L if available from either raw or processed data
      if (profitLossData?.total_realized_profit_percentage !== undefined) {
        const pnl = profitLossData;
        prompt += `\n- Trading Performance (ETH): ${parseFloat(pnl.total_realized_profit_percentage || 0).toFixed(2)}% (+$${parseFloat(pnl.total_realized_profit_usd || 0).toLocaleString()})`;
        prompt += `\n- Total Trades: ${pnl.total_count_of_trades || 0}`;
      }
      prompt += '\n\n';
    }

    // Individual Analysis Results
    if (walletData.analysis.assets) {
      prompt += `ASSET ANALYSIS:
- Risk Score: ${walletData.analysis.assets.risk_score}/100
- Key Findings: ${walletData.analysis.assets.key_findings.join(', ')}
- GPT Analysis: ${walletData.analysis.assets.gpt_analysis}

`;
    }

    if (walletData.analysis.pools) {
      prompt += `DEFI POOLS ANALYSIS:
- Risk Score: ${walletData.analysis.pools.risk_score}/100
- Key Findings: ${walletData.analysis.pools.key_findings.join(', ')}
- GPT Analysis: ${walletData.analysis.pools.gpt_analysis}

`;
    }

    if (walletData.analysis.protocols) {
      prompt += `PROTOCOL INTERACTIONS ANALYSIS:
- Risk Score: ${walletData.analysis.protocols.risk_score}/100
- Key Findings: ${walletData.analysis.protocols.key_findings.join(', ')}
- GPT Analysis: ${walletData.analysis.protocols.gpt_analysis}

`;
    }

    // Multi-Chain Transaction Activity - handle flexible data structure
    const ethTransactions = moralisData?.raw_ethereum_transactions?.result || 
                           moralisData?.raw_ethereum_transactions || 
                           moralisData?.ethereum?.transactions || [];
    
    if (ethTransactions.length > 0) {
      const ethTxCount = ethTransactions.length;
      prompt += `MULTI-CHAIN TRANSACTION ACTIVITY:
- Ethereum transactions analyzed: ${ethTxCount}
`;
    }

    // Chain-specific data breakdown - handle flexible data structure
    const chains = ['ethereum', 'base', 'polygon'];
    prompt += `CHAIN-SPECIFIC BREAKDOWN:\n`;
    
    for (const chain of chains) {
      // Try raw API data first, then fallback to processed data
      const tokenBalances = moralisData?.[`raw_${chain}_token_balances`]?.result || 
                           moralisData?.[`raw_${chain}_token_balances`] || 
                           moralisData?.[chain]?.token_balances || [];
      
      const nativeBalance = moralisData?.[`raw_${chain}_native_balance`] || 
                           moralisData?.[chain]?.native_balance || {};
      
      const defiPositions = moralisData?.[`raw_${chain}_defi_positions`]?.result || 
                           moralisData?.[`raw_${chain}_defi_positions`] || 
                           moralisData?.[chain]?.defi_positions || [];
      
      const netWorth = moralisData?.raw_multi_chain_net_worth || 
                      moralisData?.[chain]?.net_worth || {};
      
      const hasActivity = tokenBalances.length > 0 || parseFloat(nativeBalance.balance_formatted || '0') > 0;
      
      if (hasActivity) {
        prompt += `- ${chain.toUpperCase()}:\n`;
        prompt += `  Net Worth: $${parseFloat(netWorth.total_networth_usd || '0').toLocaleString()}\n`;
        prompt += `  Token Count: ${tokenBalances.length || 0}\n`;
        prompt += `  Native Balance: ${nativeBalance.balance_formatted || '0'}\n`;
        prompt += `  DeFi Positions: ${defiPositions.length || 0}\n`;
      }
    }

    prompt += `

ANALYSIS REQUEST:
Please provide a comprehensive final risk assessment considering all the above MULTI-CHAIN data. Weight the individual analysis scores appropriately and identify the most critical risk factors. Consider:

1. Asset quality and diversification risks across all chains
2. DeFi exposure and smart contract risks (including multi-chain DeFi)
3. Protocol interaction patterns across chains
4. Multi-chain portfolio construction and management
5. Cross-chain bridge risks and exposures
6. Chain-specific risks (Ethereum gas fees, L2 centralization, Polygon validator risks)
7. Suspicious activity indicators across all chains
8. Market risk exposure amplified by multi-chain complexity
9. Wallet management complexity across multiple chains

Provide actionable recommendations prioritized by impact and urgency, with specific attention to multi-chain security considerations.`;

    return prompt;
  }

  /**
   * Validate and normalize GPT response with multi-chain support
   */
  private validateAndNormalizeFinalAnalysis(analysis: any): FinalRiskAnalysis {
    const result: FinalRiskAnalysis = {
      overall_risk_score: Math.max(0, Math.min(100, analysis.overall_risk_score || 50)),
      risk_level: this.normalizeRiskLevel(analysis.risk_level || analysis.overall_risk_score || 50),
      confidence_score: Math.max(0, Math.min(100, analysis.confidence_score || 50)),
      gpt_summary: analysis.gpt_summary || 'Risk analysis completed with limited data.',
      key_risks: Array.isArray(analysis.key_risks) ? analysis.key_risks : [],
      recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : [],
      alerts: this.validateAlerts(analysis.alerts || [])
    };

    // Add multi-chain information if provided
    if (analysis.multiChainInfo && typeof analysis.multiChainInfo === 'object') {
      result.multiChainInfo = {
        totalChainsActive: Math.max(0, analysis.multiChainInfo.totalChainsActive || 0),
        chainsWithActivity: Array.isArray(analysis.multiChainInfo.chainsWithActivity) ? analysis.multiChainInfo.chainsWithActivity : [],
        crossChainRisks: Array.isArray(analysis.multiChainInfo.crossChainRisks) ? analysis.multiChainInfo.crossChainRisks : [],
        chainSpecificRisks: analysis.multiChainInfo.chainSpecificRisks && typeof analysis.multiChainInfo.chainSpecificRisks === 'object' 
          ? analysis.multiChainInfo.chainSpecificRisks 
          : {}
      };
    }

    return result;
  }

  /**
   * Normalize risk level based on score
   */
  private normalizeRiskLevel(input: string | number): 'very-low' | 'low' | 'medium' | 'high' | 'very-high' {
    if (typeof input === 'string' && ['very-low', 'low', 'medium', 'high', 'very-high'].includes(input)) {
      return input as 'very-low' | 'low' | 'medium' | 'high' | 'very-high';
    }

    const score = typeof input === 'number' ? input : 50;
    
    if (score <= 20) return 'very-low';
    if (score <= 40) return 'low';
    if (score <= 60) return 'medium';
    if (score <= 80) return 'high';
    return 'very-high';
  }

  /**
   * Validate alerts format
   */
  private validateAlerts(alerts: any[]): Array<{ severity: 'low' | 'medium' | 'high' | 'critical'; message: string }> {
    if (!Array.isArray(alerts)) return [];

    return alerts
      .filter(alert => alert && typeof alert === 'object' && alert.message)
      .map(alert => ({
        severity: ['low', 'medium', 'high', 'critical'].includes(alert.severity) ? alert.severity : 'medium',
        message: String(alert.message)
      }))
      .slice(0, 10); // Limit to 10 alerts
  }

  /**
   * Generate fallback analysis when GPT fails
   */
  private generateFallbackFinalAnalysis(walletData: WalletAnalysisData): FinalRiskAnalysis {
    // Calculate average risk score from individual analyses
    const analysisScores: number[] = [];
    const availableAnalyses: string[] = [];

    if (walletData.analysis.assets) {
      analysisScores.push(walletData.analysis.assets.risk_score);
      availableAnalyses.push('assets');
    }
    
    if (walletData.analysis.pools) {
      analysisScores.push(walletData.analysis.pools.risk_score);
      availableAnalyses.push('pools');
    }
    
    if (walletData.analysis.protocols) {
      analysisScores.push(walletData.analysis.protocols.risk_score);
      availableAnalyses.push('protocols');
    }

    const averageScore = analysisScores.length > 0 
      ? Math.round(analysisScores.reduce((sum, score) => sum + score, 0) / analysisScores.length)
      : 50;

    const confidence = Math.max(30, Math.min(70, availableAnalyses.length * 25));

    return {
      overall_risk_score: averageScore,
      risk_level: this.normalizeRiskLevel(averageScore),
      confidence_score: confidence,
      gpt_summary: `Automated risk analysis based on ${availableAnalyses.join(', ')} analysis. Overall risk score: ${averageScore}/100.`,
      key_risks: ['Limited data analysis fallback'],
      recommendations: ['Run comprehensive analysis with all data sources', 'Review individual analysis components'],
      alerts: averageScore > 70 ? [{
        severity: averageScore > 85 ? 'critical' : 'high' as 'critical' | 'high',
        message: 'High risk detected - requires immediate attention'
      }] : []
    };
  }

  /**
   * Get risk level description
   */
  getRiskLevelDescription(riskLevel: string): string {
    return this.riskLevels[riskLevel as keyof typeof this.riskLevels]?.description || 'Unknown risk level';
  }

  /**
   * Generate risk summary for frontend
   */
  generateRiskSummary(analysis: FinalRiskAnalysis): {
    status: string;
    color: string;
    description: string;
    urgency: 'none' | 'low' | 'medium' | 'high' | 'critical';
  } {
    const riskLevelMap = {
      'very-low': { status: 'Very Low Risk', color: '#10B981', urgency: 'none' as const },
      'low': { status: 'Low Risk', color: '#10B981', urgency: 'low' as const },
      'medium': { status: 'Medium Risk', color: '#F59E0B', urgency: 'medium' as const },
      'high': { status: 'High Risk', color: '#EF4444', urgency: 'high' as const },
      'very-high': { status: 'Very High Risk', color: '#DC2626', urgency: 'critical' as const }
    };

    const config = riskLevelMap[analysis.risk_level];
    
    return {
      status: config.status,
      color: config.color,
      description: this.getRiskLevelDescription(analysis.risk_level),
      urgency: config.urgency
    };
  }
}

export default FinalRiskAnalyzer;