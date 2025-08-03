import { OpenAI } from 'openai';
import MoralisAPI from './api/moralisAPI';
import DataManager from './data/dataManager';

export interface PoolAnalysisResult {
  gpt_analysis: string;
  risk_score: number;
  key_findings: string[];
  recommendations: string[];
}

class PoolAnalyzer {
  private moralisAPI: MoralisAPI;
  private dataManager: DataManager;
  private openai: OpenAI;
  
  // Knowledge base for GPT context
  private knowledgeBase = {
    protocolTiers: {
      tier1: {
        protocols: ['aave', 'compound', 'makerdao', 'uniswap', 'curve', 'lido'],
        risk: 15,
        description: 'Most established protocols with strong security track record'
      },
      tier2: {
        protocols: ['sushiswap', 'balancer', 'convex', 'yearn', 'synthetix', '1inch'],
        risk: 30,
        description: 'Well established protocols with good reputation'
      },
      tier3: {
        protocols: ['pancakeswap', 'quickswap', 'spookyswap', 'traderjoe', 'frax'],
        risk: 45,
        description: 'Newer but reputable protocols'
      },
      unknown: {
        risk: 70,
        description: 'Unknown or unvetted protocols - high risk'
      }
    },
    poolTypes: {
      lending: { baseRisk: 20, description: 'Lending/borrowing pools - smart contract risk' },
      liquidity: { baseRisk: 35, description: 'AMM liquidity pools - impermanent loss risk' },
      staking: { baseRisk: 25, description: 'Staking pools - slashing and validator risk' },
      farming: { baseRisk: 45, description: 'Yield farming - multiple smart contract risks' },
      other: { baseRisk: 50, description: 'Other DeFi positions - unknown risk profile' }
    },
    riskFactors: {
      high: ['new protocol', 'unaudited', 'high APY (>100%)', 'complex strategies', 'experimental'],
      medium: ['moderate concentration', 'IL exposure', 'validator risk', 'governance risk'],
      low: ['established protocol', 'audited contracts', 'stable pairs', 'blue chip assets']
    }
  };

  constructor(
    moralisApiKey: string,
    openaiApiKey: string,
    dataManager: DataManager
  ) {
    this.moralisAPI = new MoralisAPI(moralisApiKey);
    this.dataManager = dataManager;
    this.openai = new OpenAI({ apiKey: openaiApiKey });
  }

  /**
   * Analyze all pool positions for a wallet using GPT
   */
  async analyzeWalletPools(address: string, existingWalletData?: any): Promise<PoolAnalysisResult> {
    try {
      console.log(`🔍 Analyzing pool positions for wallet: ${address} (Moralis-only)`);
      
      // Use existing data if provided, otherwise fetch fresh data
      let moralisData;
      if (existingWalletData?.raw_data?.moralis) {
        console.log(`📖 Using pre-fetched data for pool analysis`);
        moralisData = this.transformExistingDataForPoolAnalysis(existingWalletData.raw_data.moralis);
      } else {
        console.log(`📡 Fetching fresh data for pool analysis`);
        moralisData = await this.fetchMoralisMultiChainDefiData(address);
      }

      // Store raw data (pools are part of the broader data structure)
      const poolData = this.combineMultiChainPoolData(moralisData);
      
      // If no DeFi positions found
      if (poolData.positions.length === 0) {
        const noPoolsResult = {
          gpt_analysis: 'No DeFi pool positions detected across any supported chains (Ethereum, Base, Polygon). The wallet appears to hold only basic token positions without active DeFi participation.',
          risk_score: 0,
          key_findings: ['No DeFi exposure across all chains', 'No impermanent loss risk', 'No smart contract risk from pools', 'No multi-chain DeFi complexity'],
          recommendations: [
            'Consider diversifying into established DeFi protocols if seeking yield', 
            'Start with low-risk lending protocols like Aave or Compound on Ethereum',
            'Explore Layer 2 DeFi opportunities on Base or Polygon for lower fees',
            'Begin with single-asset staking before moving to LP positions'
          ]
        };
        
        await this.dataManager.updateAnalysis(address, 'pools', noPoolsResult);
        return noPoolsResult;
      }

      // Generate GPT analysis
      const gptAnalysis = await this.generateGPTPoolAnalysis(poolData);
      
      // Store analysis results
      await this.dataManager.updateAnalysis(address, 'pools', gptAnalysis);
      
      return gptAnalysis;
      
    } catch (error: any) {
      console.error('Pool analysis error:', error.message);
      throw new Error(`Failed to analyze pools: ${error.message}`);
    }
  }

  /**
   * Transform existing wallet data to expected format for pool analysis
   */
  private transformExistingDataForPoolAnalysis(moralisRawData: any) {
    const ethDefiPositions = moralisRawData.ethereum?.defi_positions || [];
    const baseDefiPositions = moralisRawData.base?.defi_positions || [];
    const polygonDefiPositions = moralisRawData.polygon?.defi_positions || [];
    const ethPortfolioDefi = moralisRawData.ethereum?.portfolio?.defiPositions || [];

    // Calculate total DeFi value across all chains
    const totalDefiValue = [
      ...ethDefiPositions,
      ...baseDefiPositions,
      ...polygonDefiPositions
    ].reduce((sum, pos) => sum + (pos.total_usd_value || 0), 0);

    const portfolioDefiValue = ethPortfolioDefi.reduce((sum: number, pos: any) => sum + (pos.total_usd_value || 0), 0);

    return {
      ethereum: {
        defiPositions: ethDefiPositions,
        portfolioDefi: ethPortfolioDefi,
        defiValue: ethDefiPositions.reduce((sum: number, pos: any) => sum + (pos.total_usd_value || 0), 0) + portfolioDefiValue
      },
      base: {
        defiPositions: baseDefiPositions,
        defiValue: baseDefiPositions.reduce((sum: number, pos: any) => sum + (pos.total_usd_value || 0), 0)
      },
      polygon: {
        defiPositions: polygonDefiPositions,
        defiValue: polygonDefiPositions.reduce((sum: number, pos: any) => sum + (pos.total_usd_value || 0), 0)
      },
      combined: {
        totalDefiValue: totalDefiValue + portfolioDefiValue,
        totalPositions: ethDefiPositions.length + baseDefiPositions.length + polygonDefiPositions.length + ethPortfolioDefi.length,
        chainsWithDefi: [
          ethDefiPositions.length > 0 || ethPortfolioDefi.length > 0 ? 'ethereum' : null,
          baseDefiPositions.length > 0 ? 'base' : null,
          polygonDefiPositions.length > 0 ? 'polygon' : null
        ].filter(Boolean)
      }
    };
  }

  /**
   * Fetch DeFi position data from Moralis across multiple chains
   */
  private async fetchMoralisMultiChainDefiData(address: string) {
    try {
      console.log(`📡 Fetching multi-chain DeFi data from Moralis...`);
      
      // Fetch DeFi positions and portfolio data from all supported chains
      const [
        // Ethereum DeFi data
        ethDefiPositions, ethPortfolio,
        // Base DeFi data (if available)
        baseDefiPositions,
        // Polygon DeFi data (if available) 
        polygonDefiPositions
      ] = await Promise.all([
        // Ethereum
        this.moralisAPI.getDefiPositions(address, 'eth'),
        this.moralisAPI.getWalletPortfolio(address, 'eth'),
        // Base
        this.moralisAPI.getDefiPositions(address, 'base'),
        // Polygon
        this.moralisAPI.getDefiPositions(address, 'polygon')
      ]);

      // Calculate total DeFi value across all chains
      const totalDefiValue = [
        ...ethDefiPositions,
        ...baseDefiPositions,
        ...polygonDefiPositions
      ].reduce((sum, pos) => sum + (pos.total_usd_value || 0), 0);

      // Add Ethereum portfolio DeFi positions
      const ethPortfolioDefi = ethPortfolio.defiPositions || [];
      const portfolioDefiValue = ethPortfolioDefi.reduce((sum: number, pos: any) => sum + (pos.total_usd_value || 0), 0);

      return {
        ethereum: {
          defiPositions: ethDefiPositions,
          portfolioDefi: ethPortfolioDefi,
          defiValue: ethDefiPositions.reduce((sum, pos) => sum + (pos.total_usd_value || 0), 0) + portfolioDefiValue
        },
        base: {
          defiPositions: baseDefiPositions,
          defiValue: baseDefiPositions.reduce((sum, pos) => sum + (pos.total_usd_value || 0), 0)
        },
        polygon: {
          defiPositions: polygonDefiPositions,
          defiValue: polygonDefiPositions.reduce((sum, pos) => sum + (pos.total_usd_value || 0), 0)
        },
        combined: {
          totalDefiValue: totalDefiValue + portfolioDefiValue,
          totalPositions: ethDefiPositions.length + baseDefiPositions.length + polygonDefiPositions.length + ethPortfolioDefi.length,
          chainsWithDefi: [
            ethDefiPositions.length > 0 || ethPortfolioDefi.length > 0 ? 'ethereum' : null,
            baseDefiPositions.length > 0 ? 'base' : null,
            polygonDefiPositions.length > 0 ? 'polygon' : null
          ].filter(Boolean)
        }
      };
    } catch (error) {
      console.warn('Could not fetch Moralis multi-chain DeFi data');
      return {
        ethereum: { defiPositions: [], portfolioDefi: [], defiValue: 0 },
        base: { defiPositions: [], defiValue: 0 },
        polygon: { defiPositions: [], defiValue: 0 },
        combined: { totalDefiValue: 0, totalPositions: 0, chainsWithDefi: [] }
      };
    }
  }

  /**
   * Combine multi-chain pool data from Moralis
   */
  private combineMultiChainPoolData(moralisData: any) {
    const positions = [];
    const chainData: { [key: string]: any } = {};
    let totalValue = moralisData.combined.totalDefiValue;

    // Process each chain's DeFi positions
    const chains = ['ethereum', 'base', 'polygon'];
    
    for (const chain of chains) {
      const chainInfo = moralisData[chain];
      if (!chainInfo) continue;

      chainData[chain] = {
        defiValue: chainInfo.defiValue,
        positionCount: chainInfo.defiPositions.length + (chainInfo.portfolioDefi?.length || 0)
      };

      // Process Moralis DeFi positions
      for (const position of chainInfo.defiPositions) {
        positions.push({
          source: 'moralis',
          chain: chain,
          protocol: position.protocol_name || position.protocol_id || 'unknown',
          totalValue: position.total_usd_value || 0,
          type: 'defi',
          positions: position.position_details || [],
          url: position.protocol_url,
          logo: position.protocol_logo
        });
      }

      // Process portfolio DeFi positions (Ethereum only for now)
      if (chainInfo.portfolioDefi) {
        for (const position of chainInfo.portfolioDefi) {
          positions.push({
            source: 'moralis',
            chain: chain,
            protocol: position.protocol_name || 'unknown',
            totalValue: position.total_usd_value || 0,
            type: 'portfolio_defi',
            positions: position.position_details || []
          });
        }
      }
    }

    // Group by protocol across all chains
    const protocolGroups = positions.reduce((groups, position) => {
      const protocol = position.protocol.toLowerCase();
      if (!groups[protocol]) {
        groups[protocol] = {
          positions: [],
          totalValue: 0,
          chains: new Set()
        };
      }
      groups[protocol].positions.push(position);
      groups[protocol].totalValue += position.totalValue || 0;
      groups[protocol].chains.add(position.chain);
      return groups;
    }, {} as { [key: string]: any });

    // Convert chains Sets to arrays for JSON serialization
    Object.keys(protocolGroups).forEach(protocol => {
      protocolGroups[protocol].chains = Array.from(protocolGroups[protocol].chains);
    });

    return {
      totalValue,
      positionCount: positions.length,
      positions,
      protocolCount: Object.keys(protocolGroups).length,
      protocolGroups,
      chainData,
      multiChain: {
        activeChains: moralisData.combined.chainsWithDefi,
        totalChains: moralisData.combined.chainsWithDefi.length,
        crossChainExposure: Object.keys(protocolGroups).filter(protocol => 
          protocolGroups[protocol].chains.length > 1
        ).length > 0
      }
    };
  }

  /**
   * Generate GPT-powered pool analysis
   */
  private async generateGPTPoolAnalysis(poolData: any): Promise<PoolAnalysisResult> {
    try {
      const prompt = this.buildPoolAnalysisPrompt(poolData);
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `<role>
You are a DeFi risk analyst specializing in pool and protocol analysis. Analyze the provided DeFi position data with focus on smart contract risks, impermanent loss, and protocol security.
</role>

<knowledge_base>
<protocol_tiers>
<tier level="1" risk_range="10-20" description="Most established protocols with strong security track record">
${this.knowledgeBase.protocolTiers.tier1.protocols.join(', ')}
</tier>

<tier level="2" risk_range="25-35" description="Well established protocols with good reputation">
${this.knowledgeBase.protocolTiers.tier2.protocols.join(', ')}
</tier>

<tier level="3" risk_range="40-50" description="Newer but reputable protocols">
${this.knowledgeBase.protocolTiers.tier3.protocols.join(', ')}
</tier>

<tier level="unknown" risk_range="70+" description="Unknown or unvetted protocols - high risk">
Any protocol not listed above
</tier>
</protocol_tiers>

<pool_types>
<type name="lending" base_risk="20">Smart contract risk, liquidation risk</type>
<type name="liquidity" base_risk="35">Impermanent loss, price volatility</type>
<type name="staking" base_risk="25">Slashing risk, validator risk</type>
<type name="farming" base_risk="45">Multiple contract risks, token risks</type>
<type name="other" base_risk="50">Unknown risk profile</type>
</pool_types>

<risk_indicators>
<high_risk>
Unknown/unaudited protocols, Extremely high APY (>100%), Complex yield farming strategies, New or experimental protocols, High concentration in single protocol
</high_risk>
<medium_risk>
Moderate concentration, IL exposure, Validator risk, Governance risk
</medium_risk>
<low_risk>
Established protocol, Audited contracts, Stable pairs, Blue chip assets
</low_risk>
</risk_indicators>
</knowledge_base>

<risk_scoring>
<level range="0-20" category="very_low">Established protocols, stable pairs</level>
<level range="21-40" category="low">Known protocols, moderate exposure</level>
<level range="41-60" category="medium">Mixed protocols, some IL risk</level>
<level range="61-80" category="high">Risky protocols, high IL exposure</level>
<level range="81-100" category="very_high">Dangerous protocols, extreme risks</level>
</risk_scoring>

<examples>
<example>
<scenario>$50k in Aave lending USDC, $30k in Compound lending DAI</scenario>
<expected_analysis>Conservative DeFi strategy using tier-1 lending protocols with stablecoins</expected_analysis>
<expected_risk_score>18</expected_risk_score>
<expected_findings>["Tier-1 protocol usage", "Stablecoin lending strategy", "Low impermanent loss risk"]</expected_findings>
</example>

<example>
<scenario>$100k in unknown protocol "YieldMax" offering 200% APY on ETH-SHIB LP</scenario>
<expected_analysis>Extremely high risk position with unvetted protocol and suspicious yields</expected_analysis>
<expected_risk_score>95</expected_risk_score>
<expected_findings>["Unknown protocol risk", "Unsustainable APY", "High IL exposure", "Potential rug pull risk"]</expected_findings>
</example>

<example>
<scenario>$25k Uniswap V3 ETH-USDC LP, $20k Curve 3pool, $15k Lido stETH</scenario>
<expected_analysis>Diversified DeFi portfolio across established protocols with moderate risk</expected_analysis>
<expected_risk_score>32</expected_risk_score>
<expected_findings>["Good protocol diversification", "Mix of LP and staking", "Established protocol usage"]</expected_findings>
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
        throw new Error('No response from GPT while analyzing pools');
      }

      const analysis = JSON.parse(response);
      
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
      console.error('GPT pool analysis error:', error.message);
      return this.generateFallbackPoolAnalysis(poolData);
    }
  }

  /**
   * Build prompt for GPT pool analysis (multi-chain)
   */
  private buildPoolAnalysisPrompt(data: any): string {
    const { totalValue, positionCount, protocolCount, protocolGroups, positions, chainData, multiChain } = data;
    
    let prompt = `MULTI-CHAIN DEFI POOL POSITION ANALYSIS REQUEST

OVERVIEW:
- Total DeFi Value: $${totalValue.toLocaleString()}
- Number of Positions: ${positionCount}
- Protocols Used: ${protocolCount}
- Active Chains: ${multiChain.activeChains.join(', ').toUpperCase()}
- Cross-Chain Exposure: ${multiChain.crossChainExposure ? 'Yes' : 'No'}

MULTI-CHAIN BREAKDOWN:`;

    for (const [chain, data] of Object.entries(chainData)) {
      const chainInfo = data as any;
      prompt += `\n- ${chain.toUpperCase()}: $${chainInfo.defiValue.toLocaleString()} (${chainInfo.positionCount} positions)`;
    }

    prompt += `\n\nPOSITIONS BY PROTOCOL:`;

    for (const [protocol, protocolInfo] of Object.entries(protocolGroups)) {
      const info = protocolInfo as any;
      prompt += `\n- ${protocol.toUpperCase()}: ${info.positions.length} position(s), $${info.totalValue.toLocaleString()}`;
      if (info.chains.length > 1) {
        prompt += ` [Multi-chain: ${info.chains.join(', ')}]`;
      } else {
        prompt += ` [${info.chains[0]?.toUpperCase()}]`;
      }
    }

    prompt += `\n\nDETAILED POSITIONS:`;
    
    for (const position of positions.slice(0, 12)) { // Show more positions for multi-chain
      prompt += `\n- Protocol: ${position.protocol} [${position.chain?.toUpperCase()}]`;
      prompt += `\n  Value: $${(position.totalValue || 0).toLocaleString()}`;
      prompt += `\n  Type: ${position.type || 'unknown'}`;
      if (position.positions && position.positions.length > 0) {
        const tokens = position.positions.map((p: any) => p.symbol || 'Unknown').slice(0, 3);
        prompt += `\n  Underlying Tokens: ${tokens.join(', ')}`;
      }
      if (position.url) prompt += `\n  URL: ${position.url}`;
      prompt += '\n';
    }

    // Protocol risk assessment
    const tier1Protocols = Object.keys(protocolGroups).filter(p => 
      this.knowledgeBase.protocolTiers.tier1.protocols.includes(p)
    );
    const tier2Protocols = Object.keys(protocolGroups).filter(p => 
      this.knowledgeBase.protocolTiers.tier2.protocols.includes(p)
    );
    const tier3Protocols = Object.keys(protocolGroups).filter(p => 
      this.knowledgeBase.protocolTiers.tier3.protocols.includes(p)
    );
    const unknownProtocols = Object.keys(protocolGroups).filter(p => 
      !tier1Protocols.includes(p) && !tier2Protocols.includes(p) && !tier3Protocols.includes(p)
    );

    if (tier1Protocols.length > 0) {
      prompt += `\nTIER 1 PROTOCOLS (Low Risk): ${tier1Protocols.join(', ')}`;
    }
    if (tier2Protocols.length > 0) {
      prompt += `\nTIER 2 PROTOCOLS (Medium Risk): ${tier2Protocols.join(', ')}`;
    }
    if (tier3Protocols.length > 0) {
      prompt += `\nTIER 3 PROTOCOLS (Higher Risk): ${tier3Protocols.join(', ')}`;
    }
    if (unknownProtocols.length > 0) {
      prompt += `\nUNKNOWN PROTOCOLS (High Risk): ${unknownProtocols.join(', ')}`;
    }

    // Multi-chain specific analysis
    if (multiChain.totalChains > 1) {
      prompt += `\n\nMULTI-CHAIN RISK FACTORS:`;
      prompt += `\n- Bridge Risk: Exposure to cross-chain bridges`;
      prompt += `\n- Network Risk: Different security models across chains`;
      prompt += `\n- Liquidity Fragmentation: Assets spread across multiple chains`;
      if (multiChain.crossChainExposure) {
        prompt += `\n- Cross-Chain Protocols: Same protocols used on multiple chains`;
      }
    }

    prompt += `\n\nPlease analyze this MULTI-CHAIN DeFi portfolio focusing on:
1. Protocol security and reputation assessment across all chains
2. Impermanent loss risk from liquidity positions
3. Smart contract risk exposure (including multi-chain risks)
4. Diversification across protocols and chains
5. Cross-chain bridge risks and vulnerabilities
6. Chain-specific risks (Ethereum gas, L2 centralization, etc.)
7. Yield sustainability and red flags
8. Overall multi-chain DeFi risk profile

Provide specific recommendations for risk mitigation and position optimization across all active chains.`;

    return prompt;
  }

  /**
   * Generate fallback analysis when GPT fails
   */
  private generateFallbackPoolAnalysis(data: any): PoolAnalysisResult {
    const { totalValue, positionCount, protocolGroups } = data;
    
    let riskScore = 40; // Base medium risk for DeFi
    const keyFindings: string[] = [];
    const recommendations: string[] = [];

    // Protocol tier analysis
    const protocols = Object.keys(protocolGroups);
    const tier1Count = protocols.filter(p => this.knowledgeBase.protocolTiers.tier1.protocols.includes(p)).length;
    const unknownCount = protocols.filter(p => 
      !this.knowledgeBase.protocolTiers.tier1.protocols.includes(p) &&
      !this.knowledgeBase.protocolTiers.tier2.protocols.includes(p) &&
      !this.knowledgeBase.protocolTiers.tier3.protocols.includes(p)
    ).length;

    if (tier1Count > 0) {
      riskScore -= 10;
      keyFindings.push(`${tier1Count} position(s) in tier-1 protocols`);
    }

    if (unknownCount > 0) {
      riskScore += unknownCount * 15;
      keyFindings.push(`${unknownCount} position(s) in unknown protocols`);
      recommendations.push('Research unknown protocols for security audits and reputation');
    }

    // Diversification assessment
    if (protocols.length === 1) {
      riskScore += 20;
      keyFindings.push('All positions concentrated in single protocol');
      recommendations.push('Diversify across multiple established protocols');
    } else if (protocols.length > 3) {
      riskScore -= 10;
      keyFindings.push('Good protocol diversification');
    }

    riskScore = Math.max(0, Math.min(100, riskScore));

    return {
      gpt_analysis: `DeFi analysis shows ${positionCount} positions across ${protocols.length} protocols with total value of $${totalValue.toLocaleString()}. ${keyFindings.join('. ')}.`,
      risk_score: riskScore,
      key_findings: keyFindings,
      recommendations: recommendations
    };
  }
}

export default PoolAnalyzer;