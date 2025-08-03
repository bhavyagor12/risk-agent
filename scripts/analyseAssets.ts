import { OpenAI } from 'openai';
import ZerionAPI from './api/zerionAPI';
import MoralisAPI from './api/moralisAPI';
import DataManager from './data/dataManager';

export interface AssetAnalysisResult {
  gpt_analysis: string;
  risk_score: number;
  key_findings: string[];
  recommendations: string[];
}

class AssetAnalyzer {
  private zerionAPI: ZerionAPI;
  private moralisAPI: MoralisAPI;
  private dataManager: DataManager;
  private openai: OpenAI;
  
  // Deterministic knowledge base for GPT context
  private knowledgeBase = {
    stableTokens: [
      'USDT', 'USDC', 'DAI', 'BUSD', 'FRAX', 'TUSD', 'USDP', 'LUSD', 'MIM'
    ],
    establishedTokens: [
      'BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT', 'AVAX', 'MATIC', 'LINK',
      'UNI', 'AAVE', 'CRV', 'COMP', 'MKR', 'SNX', 'YFI', 'SUSHI', 'GRT', 'ENS'
    ],
    riskIndicators: {
      scamPatterns: ['test', 'fake', 'scam', 'moon', 'safe', 'inu', 'doge', 'pepe'],
      highRiskFactors: ['low market cap', 'new token', 'unverified contract', 'high concentration'],
      positiveFactors: ['blue chip token', 'established protocol', 'high liquidity', 'good diversification']
    },
    marketCapTiers: {
      'top-10': { risk: 10, description: 'Extremely established, lowest risk' },
      'top-100': { risk: 20, description: 'Well established, low risk' },
      'top-500': { risk: 40, description: 'Established, moderate risk' },
      'top-1000': { risk: 60, description: 'Less established, higher risk' },
      'below-1000': { risk: 80, description: 'High risk, low market cap' }
    }
  };

  constructor(
    zerionApiKey: string, 
    moralisApiKey: string, 
    openaiApiKey: string,
    dataManager: DataManager
  ) {
    this.zerionAPI = new ZerionAPI(zerionApiKey);
    this.moralisAPI = new MoralisAPI(moralisApiKey);
    this.dataManager = dataManager;
    this.openai = new OpenAI({ apiKey: openaiApiKey });
  }

  /**
   * Analyze all assets in a wallet using GPT with deterministic knowledge
   */
  async analyzeWalletAssets(address: string): Promise<AssetAnalysisResult> {
    try {
      console.log(`🔍 Analyzing assets for wallet: ${address}`);
      
      // Fetch data from multiple sources
      const [zerionData, moralisData] = await Promise.all([
        this.fetchZerionAssetData(address),
        this.fetchMoralisAssetData(address)
      ]);

      // Store raw data
      await this.dataManager.updateRawData(address, 'zerion', {
        portfolio: zerionData.portfolio,
        pnl: zerionData.pnl
      });

      await this.dataManager.updateRawData(address, 'moralis', {
        token_balances: moralisData.tokenBalances,
        native_balance: moralisData.nativeBalance,
        net_worth: moralisData.netWorth
      });

      // Combine and structure data for GPT analysis
      const combinedAssetData = this.combineAssetData(zerionData, moralisData);
      
      // Generate GPT analysis
      const gptAnalysis = await this.generateGPTAssetAnalysis(combinedAssetData);
      
      // Store analysis results
      await this.dataManager.updateAnalysis(address, 'assets', gptAnalysis);
      
      return gptAnalysis;
      
    } catch (error: any) {
      console.error('Asset analysis error:', error.message);
      throw new Error(`Failed to analyze assets: ${error.message}`);
    }
  }

  /**
   * Fetch asset data from Zerion
   */
  private async fetchZerionAssetData(address: string) {
    try {
      const [portfolio, pnl] = await Promise.all([
        this.zerionAPI.getWalletPortfolio(address),
        this.zerionAPI.getWalletPnL(address)
      ]);
      
      return { portfolio, pnl };
    } catch (error) {
      console.warn('Could not fetch Zerion asset data');
      return {
        portfolio: { totalValue: 0, positions: [], currency: 'usd' },
        pnl: { total_pnl: 0, total_pnl_percentage: 0, realized_pnl: 0, unrealized_pnl: 0, currency: 'usd' }
      };
    }
  }

  /**
   * Fetch asset data from Moralis
   */
  private async fetchMoralisAssetData(address: string) {
    try {
      const [tokenBalances, nativeBalance, netWorth] = await Promise.all([
        this.moralisAPI.getTokenBalances(address),
        this.moralisAPI.getNativeBalance(address),
        this.moralisAPI.getNetWorth(address)
      ]);
      
      return { tokenBalances, nativeBalance, netWorth };
    } catch (error) {
      console.warn('Could not fetch Moralis asset data');
      return {
        tokenBalances: [],
        nativeBalance: { balance: '0', balance_formatted: '0' },
        netWorth: { total_networth_usd: '0', chains: [] }
      };
    }
  }

  /**
   * Combine asset data from multiple sources
   */
  private combineAssetData(zerionData: any, moralisData: any) {
    const assets = [];
    const totalPortfolioValue = Math.max(
      zerionData.portfolio.totalValue,
      parseFloat(moralisData.netWorth.total_networth_usd)
    );

    // Process Zerion positions
    for (const position of zerionData.portfolio.positions) {
      assets.push({
        source: 'zerion',
        symbol: position.asset,
        balance: position.quantity,
        valueUSD: position.value,
        percentage: totalPortfolioValue > 0 ? (position.value / totalPortfolioValue) * 100 : 0,
        type: position.type,
        protocol: position.protocol,
        contractAddress: position.contractAddress
      });
    }

    // Add ETH balance from Moralis
    if (parseFloat(moralisData.nativeBalance.balance_formatted) > 0) {
      const ethValue = parseFloat(moralisData.nativeBalance.balance_formatted) * 2000; // Rough ETH price
      assets.push({
        source: 'moralis',
        symbol: 'ETH',
        balance: parseFloat(moralisData.nativeBalance.balance_formatted),
        valueUSD: ethValue,
        percentage: totalPortfolioValue > 0 ? (ethValue / totalPortfolioValue) * 100 : 0,
        type: 'native',
        contractAddress: 'native'
      });
    }

    // Add token balances from Moralis
    for (const token of moralisData.tokenBalances) {
      if (!token.possible_spam && parseFloat(token.balance) > 0) {
        const value = 0; // Would need price data
        assets.push({
          source: 'moralis',
          symbol: token.symbol,
          name: token.name,
          balance: parseFloat(token.balance) / Math.pow(10, token.decimals),
          valueUSD: value,
          percentage: 0,
          type: 'token',
          contractAddress: token.token_address,
          verified: token.verified_contract,
          possibleSpam: token.possible_spam
        });
      }
    }

    return {
      totalPortfolioValue,
      assetCount: assets.length,
      assets: assets.sort((a, b) => b.valueUSD - a.valueUSD),
      pnl: zerionData.pnl
    };
  }

  /**
   * Generate GPT-powered asset analysis
   */
  private async generateGPTAssetAnalysis(combinedData: any): Promise<AssetAnalysisResult> {
    try {
      const prompt = this.buildAssetAnalysisPrompt(combinedData);
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `<role>
You are a professional cryptocurrency portfolio risk analyst. Analyze the provided wallet asset data and provide a comprehensive risk assessment.
</role>

<knowledge_base>
<stable_tokens risk_level="low">
${this.knowledgeBase.stableTokens.join(', ')}
</stable_tokens>

<established_tokens risk_level="lower">
${this.knowledgeBase.establishedTokens.join(', ')}
</established_tokens>

<risk_indicators>
<scam_patterns severity="high">
${this.knowledgeBase.riskIndicators.scamPatterns.join(', ')}
</scam_patterns>

<high_risk_factors>
${this.knowledgeBase.riskIndicators.highRiskFactors.join(', ')}
</high_risk_factors>

<positive_factors>
${this.knowledgeBase.riskIndicators.positiveFactors.join(', ')}
</positive_factors>
</risk_indicators>
</knowledge_base>

<risk_scoring>
<level range="0-20" category="very_low">Blue chip, stable assets</level>
<level range="21-40" category="low">Established tokens, good diversification</level>
<level range="41-60" category="medium">Mixed portfolio, some concerns</level>
<level range="61-80" category="high">Concentration, unknown tokens, scam indicators</level>
<level range="81-100" category="very_high">Likely scams, extreme concentration, dangerous tokens</level>
</risk_scoring>

<examples>
<example>
<scenario>Portfolio with 70% USDC, 20% ETH, 10% BTC</scenario>
<expected_analysis>Very conservative portfolio with stablecoins and blue chips</expected_analysis>
<expected_risk_score>15</expected_risk_score>
<expected_findings>["High stablecoin allocation", "Blue chip exposure", "Good risk management"]</expected_findings>
</example>

<example>
<scenario>Portfolio with 80% unknown tokens, several with "SAFE" or "MOON" in name</scenario>
<expected_analysis>High risk portfolio with potential scam tokens</expected_analysis>
<expected_risk_score>85</expected_risk_score>
<expected_findings>["Multiple scam indicators", "Unknown token concentration", "High speculative risk"]</expected_findings>
</example>

<example>
<scenario>Portfolio with 40% ETH, 30% AAVE, 20% UNI, 10% LINK</scenario>
<expected_analysis>Well-diversified DeFi portfolio with established tokens</expected_analysis>
<expected_risk_score>25</expected_risk_score>
<expected_findings>["Good diversification", "Established DeFi tokens", "Moderate risk profile"]</expected_findings>
</example>
</examples>

<output_format>
Respond with valid JSON only:
{
  "gpt_analysis": "detailed analysis text",
  "risk_score": number (0-100),
  "key_findings": ["finding1", "finding2", ...],
  "recommendations": ["rec1", "rec2", ...]
}
</output_format>`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from GPT');
      }

      // Parse the JSON response
      const analysis = JSON.parse(response);
      
      // Validate the response structure
      if (!analysis.gpt_analysis || typeof analysis.risk_score !== 'number') {
        throw new Error('Invalid GPT response structure');
      }

      return {
        gpt_analysis: analysis.gpt_analysis,
        risk_score: Math.max(0, Math.min(100, analysis.risk_score)),
        key_findings: analysis.key_findings || [],
        recommendations: analysis.recommendations || []
      };

    } catch (error: any) {
      console.error('GPT analysis error:', error.message);
      
      // Fallback analysis
      return this.generateFallbackAssetAnalysis(combinedData);
    }
  }

  /**
   * Build prompt for GPT asset analysis
   */
  private buildAssetAnalysisPrompt(data: any): string {
    const { totalPortfolioValue, assetCount, assets, pnl } = data;
    
    let prompt = `WALLET ASSET ANALYSIS REQUEST

PORTFOLIO OVERVIEW:
- Total Portfolio Value: $${totalPortfolioValue.toLocaleString()}
- Number of Assets: ${assetCount}
- Recent P&L: ${pnl.total_pnl_percentage.toFixed(2)}% (${pnl.total_pnl >= 0 ? '+' : ''}$${pnl.total_pnl.toLocaleString()})

TOP ASSETS BY VALUE:`;

    // Show top 10 assets by value
    const topAssets = assets.slice(0, 10);
    for (const asset of topAssets) {
      prompt += `\n- ${asset.symbol}: $${asset.valueUSD.toLocaleString()} (${asset.percentage.toFixed(1)}%)`;
      if (asset.type === 'defi') prompt += ` [DeFi: ${asset.protocol}]`;
      if (asset.possibleSpam) prompt += ` [POTENTIAL SPAM]`;
      if (!asset.verified) prompt += ` [UNVERIFIED]`;
    }

    if (assets.length > 10) {
      prompt += `\n... and ${assets.length - 10} more assets`;
    }

    prompt += `\n\nASSET BREAKDOWN BY TYPE:`;
    const typeBreakdown = assets.reduce((acc: any, asset: any) => {
      acc[asset.type] = (acc[asset.type] || 0) + 1;
      return acc;
    }, {});
    
    for (const [type, count] of Object.entries(typeBreakdown)) {
      prompt += `\n- ${type}: ${count} assets`;
    }

    // Add concentration analysis
    const top1Percent = assets[0]?.percentage || 0;
    const top3Percent = assets.slice(0, 3).reduce((sum: number, asset: any) => sum + asset.percentage, 0);
    
    prompt += `\n\nCONCENTRATION ANALYSIS:
- Largest position: ${top1Percent.toFixed(1)}%
- Top 3 positions: ${top3Percent.toFixed(1)}%`;

    // Add suspicious tokens
    const suspiciousTokens = assets.filter((asset: any) => 
      asset.possibleSpam || 
      !asset.verified || 
      this.knowledgeBase.riskIndicators.scamPatterns.some(pattern => 
        asset.symbol.toLowerCase().includes(pattern.toLowerCase())
      )
    );

    if (suspiciousTokens.length > 0) {
      prompt += `\n\nSUSPICIOUS TOKENS DETECTED:`;
      for (const token of suspiciousTokens.slice(0, 5)) {
        prompt += `\n- ${token.symbol}: ${token.possibleSpam ? 'Marked as spam, ' : ''}${!token.verified ? 'Unverified contract' : ''}`;
      }
    }

    prompt += `\n\nPlease analyze this portfolio for asset-related risks, focusing on:
1. Token legitimacy and scam detection
2. Portfolio concentration and diversification
3. Asset quality and establishment level
4. Potential vulnerabilities
5. Overall risk assessment

Provide specific actionable recommendations for risk mitigation.`;

    return prompt;
  }

  /**
   * Generate fallback analysis when GPT fails
   */
  private generateFallbackAssetAnalysis(data: any): AssetAnalysisResult {
    const { totalPortfolioValue, assetCount, assets } = data;
    
    let riskScore = 50; // Base score
    const keyFindings: string[] = [];
    const recommendations: string[] = [];

    // Basic concentration analysis
    const top1Percent = assets[0]?.percentage || 0;
    if (top1Percent > 70) {
      riskScore += 25;
      keyFindings.push('Extreme concentration in single asset');
      recommendations.push('Diversify portfolio to reduce concentration risk');
    } else if (top1Percent > 50) {
      riskScore += 15;
      keyFindings.push('High concentration in top asset');
    }

    // Scam token detection
    const scamTokens = assets.filter((asset: any) => 
      asset.possibleSpam || 
      this.knowledgeBase.riskIndicators.scamPatterns.some(pattern => 
        asset.symbol.toLowerCase().includes(pattern.toLowerCase())
      )
    );

    if (scamTokens.length > 0) {
      riskScore += scamTokens.length * 10;
      keyFindings.push(`${scamTokens.length} potential scam token(s) detected`);
      recommendations.push('Remove or investigate suspicious tokens');
    }

    // Established token bonus
    const establishedTokens = assets.filter((asset: any) => 
      this.knowledgeBase.establishedTokens.includes(asset.symbol)
    );

    if (establishedTokens.length > 0) {
      riskScore -= Math.min(20, establishedTokens.length * 3);
      keyFindings.push(`Portfolio includes ${establishedTokens.length} established token(s)`);
    }

    riskScore = Math.max(0, Math.min(100, riskScore));

    return {
      gpt_analysis: `Automated analysis of wallet assets. Portfolio contains ${assetCount} assets worth $${totalPortfolioValue.toLocaleString()}. ${keyFindings.length > 0 ? keyFindings.join('. ') + '.' : 'No major issues detected.'}`,
      risk_score: riskScore,
      key_findings: keyFindings,
      recommendations: recommendations
    };
  }
}

export default AssetAnalyzer;
