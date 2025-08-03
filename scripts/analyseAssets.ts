import { OpenAI } from 'openai';
import MoralisAPI from './api/moralisAPI';
import SerpAPI from './api/serpAPI';
import DataManager from './data/dataManager';

export interface AssetAnalysisResult {
  gpt_analysis: string;
  risk_score: number;
  key_findings: string[];
  recommendations: string[];
}

class AssetAnalyzer {
  private moralisAPI: MoralisAPI;
  private dataManager: DataManager;
  private openai: OpenAI;
  private serpAPI: SerpAPI;
  
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
    moralisApiKey: string, 
    openaiApiKey: string,
    serpApiKey: string,
    dataManager: DataManager
  ) {
    this.moralisAPI = new MoralisAPI(moralisApiKey);
    this.dataManager = dataManager;
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.serpAPI = new SerpAPI(serpApiKey);
  }

  /**
   * Analyze all assets in a wallet using GPT with deterministic knowledge
   */
  async analyzeWalletAssets(address: string, existingWalletData?: any): Promise<AssetAnalysisResult> {
    try {
      console.log(`🔍 Analyzing assets for wallet: ${address} (Moralis-only)`);
      
      // Use existing data if provided, otherwise fetch fresh data
      let moralisData;
      if (existingWalletData?.raw_data?.moralis) {
        console.log(`📖 Using pre-fetched data for asset analysis`);
        moralisData = this.transformExistingDataForAssetAnalysis(existingWalletData.raw_data.moralis);
      } else {
        console.log(`📡 Fetching fresh data for asset analysis`);
        moralisData = await this.fetchMoralisMultiChainData(address);
        
        // Store raw multi-chain data only if we fetched fresh data
        await this.dataManager.updateRawData(address, 'moralis', {
          ethereum: {
            token_balances: moralisData.ethereum.tokenBalances,
            native_balance: moralisData.ethereum.nativeBalance,
            net_worth: moralisData.ethereum.netWorth,
            portfolio: moralisData.ethereum.portfolio,
            profit_loss: moralisData.ethereum.profitLoss
          },
          base: {
            token_balances: moralisData.base.tokenBalances,
            native_balance: moralisData.base.nativeBalance,
            net_worth: moralisData.base.netWorth
          },
          polygon: {
            token_balances: moralisData.polygon.tokenBalances,
            native_balance: moralisData.polygon.nativeBalance,
            net_worth: moralisData.polygon.netWorth
          },
          combined_metrics: moralisData.combinedMetrics
        });
      }

      // Structure data for GPT analysis
      const combinedAssetData = this.combineMultiChainAssetData(moralisData);
      
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
   * Transform existing wallet data to expected format for asset analysis
   */
  private transformExistingDataForAssetAnalysis(moralisRawData: any) {
    // Calculate combined metrics
    const totalNetWorth = [
      moralisRawData.ethereum?.net_worth,
      moralisRawData.base?.net_worth,
      moralisRawData.polygon?.net_worth
    ].reduce((sum, nw) => sum + parseFloat(nw?.total_networth_usd || '0'), 0);

    const totalTokenCount = (moralisRawData.ethereum?.token_balances?.length || 0) +
                           (moralisRawData.base?.token_balances?.length || 0) +
                           (moralisRawData.polygon?.token_balances?.length || 0);

    return {
      ethereum: {
        tokenBalances: moralisRawData.ethereum?.token_balances || [],
        nativeBalance: moralisRawData.ethereum?.native_balance || { balance: '0', balance_formatted: '0' },
        netWorth: moralisRawData.ethereum?.net_worth || { total_networth_usd: '0', chains: [] },
        portfolio: moralisRawData.ethereum?.portfolio || { totalValue: 0, nativeBalance: { balance: '0', balance_formatted: '0' }, tokenBalances: [], nftBalances: [], defiPositions: [], netWorth: { total_networth_usd: '0', chains: [] }, profitLoss: {} },
        profitLoss: moralisRawData.ethereum?.profit_loss || {}
      },
      base: {
        tokenBalances: moralisRawData.base?.token_balances || [],
        nativeBalance: moralisRawData.base?.native_balance || { balance: '0', balance_formatted: '0' },
        netWorth: moralisRawData.base?.net_worth || { total_networth_usd: '0', chains: [] }
      },
      polygon: {
        tokenBalances: moralisRawData.polygon?.token_balances || [],
        nativeBalance: moralisRawData.polygon?.native_balance || { balance: '0', balance_formatted: '0' },
        netWorth: moralisRawData.polygon?.net_worth || { total_networth_usd: '0', chains: [] }
      },
      combinedMetrics: moralisRawData.combined_metrics || {
        totalNetWorth,
        totalTokenCount,
        chainsWithActivity: [
          (moralisRawData.ethereum?.token_balances?.length > 0 || moralisRawData.ethereum?.portfolio?.tokenBalances?.length > 0 || parseFloat(moralisRawData.ethereum?.native_balance?.balance_formatted || '0') > 0) ? 'ethereum' : null,
          (moralisRawData.base?.token_balances?.length > 0 || parseFloat(moralisRawData.base?.native_balance?.balance_formatted || '0') > 0) ? 'base' : null,
          (moralisRawData.polygon?.token_balances?.length > 0 || parseFloat(moralisRawData.polygon?.native_balance?.balance_formatted || '0') > 0) ? 'polygon' : null
        ].filter(Boolean)
      }
    };
  }

  /**
   * Fetch comprehensive multi-chain asset data from Moralis
   */
  private async fetchMoralisMultiChainData(address: string) {
    try {
      console.log(`📡 Fetching multi-chain data from Moralis...`);
      
      // Fetch data from all chains in parallel
      const [
        // Ethereum data
        ethTokenBalances, ethNativeBalance, ethPortfolio, ethProfitLoss,
        // Base data
        baseTokenBalances, baseNativeBalance,
        // Polygon data
        polygonTokenBalances, polygonNativeBalance,
        // Multi-chain net worth (single call for all chains)
        multiChainNetWorth
      ] = await Promise.all([
        // Ethereum
        this.moralisAPI.getTokenBalances(address, 'eth'),
        this.moralisAPI.getNativeBalance(address, 'eth'),
        this.moralisAPI.getWalletPortfolio(address, 'eth'),
        this.moralisAPI.getProfitAndLoss(address, 'eth'),
        // Base
        this.moralisAPI.getTokenBalances(address, 'base'),
        this.moralisAPI.getNativeBalance(address, 'base'),
        // Polygon
        this.moralisAPI.getTokenBalances(address, 'polygon'),
        this.moralisAPI.getNativeBalance(address, 'polygon'),
        // Multi-chain net worth (single API call - gets all chains by default)
        this.moralisAPI.getNetWorth(address)
      ]);

      // Extract chain-specific net worth data from multi-chain response
      const ethNetWorth = {
        total_networth_usd: multiChainNetWorth.total_networth_usd,
        chains: multiChainNetWorth.chains?.filter(chain => chain.chain === 'eth' || chain.chain === 'ethereum') || []
      };
      
      const baseNetWorth = {
        total_networth_usd: multiChainNetWorth.total_networth_usd,
        chains: multiChainNetWorth.chains?.filter(chain => chain.chain === 'base') || []
      };
      
      const polygonNetWorth = {
        total_networth_usd: multiChainNetWorth.total_networth_usd,
        chains: multiChainNetWorth.chains?.filter(chain => chain.chain === 'polygon') || []
      };

      // Calculate combined metrics
      const totalNetWorth = parseFloat(multiChainNetWorth.total_networth_usd || '0');

      const totalTokenCount = ethTokenBalances.length + baseTokenBalances.length + polygonTokenBalances.length;
      
      return {
        ethereum: {
          tokenBalances: ethTokenBalances,
          nativeBalance: ethNativeBalance,
          netWorth: ethNetWorth,
          portfolio: ethPortfolio,
          profitLoss: ethProfitLoss
        },
        base: {
          tokenBalances: baseTokenBalances,
          nativeBalance: baseNativeBalance,
          netWorth: baseNetWorth
        },  
        polygon: {
          tokenBalances: polygonTokenBalances,
          nativeBalance: polygonNativeBalance,
          netWorth: polygonNetWorth
        },
        combinedMetrics: {
          totalNetWorth,
          totalTokenCount,
          chainsWithActivity: [
            ethTokenBalances.length > 0 || parseFloat(ethNativeBalance.balance_formatted) > 0 ? 'ethereum' : null,
            baseTokenBalances.length > 0 || parseFloat(baseNativeBalance.balance_formatted) > 0 ? 'base' : null,
            polygonTokenBalances.length > 0 || parseFloat(polygonNativeBalance.balance_formatted) > 0 ? 'polygon' : null
          ].filter(Boolean)
        }
      };
    } catch (error) {
      console.warn('Could not fetch Moralis multi-chain asset data');
      return {
        ethereum: {
          tokenBalances: [],
          nativeBalance: { balance: '0', balance_formatted: '0' },
          netWorth: { total_networth_usd: '0', chains: [] },
          portfolio: { totalValue: 0, nativeBalance: { balance: '0', balance_formatted: '0' }, tokenBalances: [], nftBalances: [], defiPositions: [], netWorth: { total_networth_usd: '0', chains: [] }, profitLoss: {} },
          profitLoss: {}
        },
        base: {
          tokenBalances: [],
          nativeBalance: { balance: '0', balance_formatted: '0' },
          netWorth: { total_networth_usd: '0', chains: [] }
        },
        polygon: {
          tokenBalances: [],
          nativeBalance: { balance: '0', balance_formatted: '0' },
          netWorth: { total_networth_usd: '0', chains: [] }
        },
        combinedMetrics: {
          totalNetWorth: 0,
          totalTokenCount: 0,
          chainsWithActivity: []
        }
      };
    }
  }

  /**
   * Combine multi-chain asset data from Moralis
   */
  private combineMultiChainAssetData(moralisData: any) {
    const assets = [];
    const chainData: { [key: string]: any } = {};
    const totalPortfolioValue = moralisData.combinedMetrics.totalNetWorth;

    // Process each chain
    const chains = ['ethereum', 'base', 'polygon'];
    
    for (const chain of chains) {
      const chainInfo = moralisData[chain];
      if (!chainInfo) continue;

      chainData[chain] = {
        nativeBalance: parseFloat(chainInfo.nativeBalance?.balance_formatted || '0'),
        tokenCount: chainInfo.tokenBalances?.length || 0,
        netWorth: parseFloat(chainInfo.netWorth?.total_networth_usd || '0')
      };

      // Add native token (ETH, BASE ETH, MATIC)
      if (parseFloat(chainInfo.nativeBalance?.balance_formatted || '0') > 0) {
        const nativeSymbol = chain === 'ethereum' ? 'ETH' : chain === 'base' ? 'ETH' : 'MATIC';
        const nativeValue = chainData[chain].nativeBalance * (chain === 'polygon' ? 1 : 1800); // Rough prices
        
        assets.push({
          source: 'moralis',
          chain: chain,
          symbol: nativeSymbol,
          balance: chainData[chain].nativeBalance,
          valueUSD: nativeValue,
          percentage: totalPortfolioValue > 0 ? (nativeValue / totalPortfolioValue) * 100 : 0,
          type: 'native',
          contractAddress: 'native',
          verified: true,
          possibleSpam: false
        });
      }

      // Add token balances
      for (const token of chainInfo.tokenBalances || []) {
        if (parseFloat(token.balance) > 0) {
          const tokenBalance = parseFloat(token.balance) / Math.pow(10, token.decimals);
          // Use net worth data or rough estimation
          const tokenValue = chainInfo.netWorth ? 
            (parseFloat(chainInfo.netWorth.total_networth_usd) / (chainInfo.tokenBalances?.length || 1)) : 0;
          
          assets.push({
            source: 'moralis',
            chain: chain,
            symbol: token.symbol,
            name: token.name,
            balance: tokenBalance,
            valueUSD: tokenValue,
            percentage: totalPortfolioValue > 0 ? (tokenValue / totalPortfolioValue) * 100 : 0,
            type: 'token',
            contractAddress: token.token_address,
            verified: token.verified_contract,
            possibleSpam: token.possible_spam
          });
        }
      }
    }

    // Add DeFi positions from Ethereum portfolio
    if (moralisData.ethereum.portfolio && moralisData.ethereum.portfolio.defiPositions) {
      for (const defiPos of moralisData.ethereum.portfolio.defiPositions) {
        assets.push({
          source: 'moralis',
          chain: 'ethereum',
          symbol: defiPos.protocol_name || 'DeFi Position',
          type: 'defi',
          valueUSD: defiPos.total_usd_value || 0,
          percentage: totalPortfolioValue > 0 ? ((defiPos.total_usd_value || 0) / totalPortfolioValue) * 100 : 0,
          protocol: defiPos.protocol_name,
          verified: true,
          possibleSpam: false
        });
      }
    }

    return {
      totalPortfolioValue,
      assetCount: assets.length,
      assets: assets.sort((a, b) => b.valueUSD - a.valueUSD),
      chainData,
      multiChain: {
        activeChains: moralisData.combinedMetrics?.chainsWithActivity || [],
        totalChains: moralisData.combinedMetrics?.chainsWithActivity?.length || 0,
        totalTokenCount: moralisData.combinedMetrics?.totalTokenCount || 0
      },
      pnl: moralisData.ethereum.profitLoss || {}
    };
  }

  /**
   * Web search function for GPT to use (powered by SerpAPI)
   */
  private async webSearch(query: string): Promise<string> {
    try {
      console.log(`🌐 GPT requested web search for: "${query}"`);
      
      // Determine search type based on query content
      const lowerQuery = query.toLowerCase();
      let searchResults;
      
      if (lowerQuery.includes('scam') || lowerQuery.includes('security') || lowerQuery.includes('hack') || lowerQuery.includes('audit')) {
        // Extract token symbol from query for security search
        const tokenMatch = query.match(/\b([A-Z]{2,10})\b/);
        if (tokenMatch) {
          searchResults = await this.serpAPI.searchTokenSecurity(tokenMatch[1]);
        } else {
          searchResults = await this.serpAPI.search(query, { num: 6 });
        }
      } else if (lowerQuery.includes('news') || lowerQuery.includes('recent') || lowerQuery.includes('latest')) {
        // Extract token symbol for news search
        const tokenMatch = query.match(/\b([A-Z]{2,10})\b/);
        if (tokenMatch) {
          searchResults = await this.serpAPI.searchTokenNews(tokenMatch[1]);
        } else {
          searchResults = await this.serpAPI.search(query, { num: 5 });
        }
      } else if (lowerQuery.includes('market') || lowerQuery.includes('price') || lowerQuery.includes('cap')) {
        // Extract token symbol for market search
        const tokenMatch = query.match(/\b([A-Z]{2,10})\b/);
        if (tokenMatch) {
          searchResults = await this.serpAPI.searchTokenMarket(tokenMatch[1]);
        } else {
          searchResults = await this.serpAPI.search(query, { num: 5 });
        }
      } else {
        // General search
        searchResults = await this.serpAPI.search(query, { num: 8 });
      }
      
      // Format results for GPT consumption
      return this.serpAPI.formatSearchResults(searchResults);
      
    } catch (error: any) {
      console.error(`❌ Web search error for "${query}":`, error.message);
      return `Unable to perform web search for "${query}": ${error.message}. This may be due to API limits, network issues, or invalid search terms.`;
    }
  }

  /**
   * Generate GPT-powered asset analysis with web search capabilities
   */
  private async generateGPTAssetAnalysis(combinedData: any): Promise<AssetAnalysisResult> {
    try {
      const prompt = this.buildAssetAnalysisPrompt(combinedData);
      
      // Define the web search tool for GPT
      const tools = [
        {
          type: "function" as const,
          function: {
            name: "web_search",
            description: "Search the web for real-time information about cryptocurrency tokens, security issues, market data, or recent news. Use this to verify token legitimacy, check for recent security incidents, or gather current market sentiment.",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "The search query. Be specific and include relevant keywords. Examples: 'TOKEN_NAME scam security audit', 'TOKEN_NAME recent news hack', 'TOKEN_NAME market cap legitimacy'"
                }
              },
              required: ["query"]
            }
          }
        }
      ];

      let messages: any[] = [
        {
          role: "system" as const,
          content: `<role>
You are a professional cryptocurrency portfolio risk analyst. Analyze the provided wallet asset data and provide a comprehensive risk assessment.

You have access to a web search tool to gather real-time information about tokens. Use it strategically to:
- Verify legitimacy of unknown or suspicious tokens
- Check for recent security incidents or hacks
- Gather current market sentiment and news
- Investigate tokens with suspicious names or patterns
- Look up audit reports and security assessments

IMPORTANT: Only search for tokens that seem suspicious, unknown, or require additional verification. Don't waste searches on well-known tokens like ETH, BTC, USDC unless there are specific concerns.
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
After completing your analysis (including any web searches), respond with valid JSON only:
{
  "gpt_analysis": "detailed analysis text including any findings from web searches",
  "risk_score": number (0-100),
  "key_findings": ["finding1", "finding2", ...],
  "recommendations": ["rec1", "rec2", ...]
}
</output_format>`
        },
        {
          role: "user" as const,
          content: prompt
        }
      ];

      // Function calling loop
      let maxIterations = 5;
      let currentIteration = 0;

      while (currentIteration < maxIterations) {
        const completion = await this.openai.chat.completions.create({
          model: "gpt-4",
          messages: messages,
          tools: tools,
          tool_choice: "auto",
          temperature: 0.3,
          max_tokens: 2000
        });

        const message = completion.choices[0]?.message;
        if (!message) {
          throw new Error('No message from GPT');
        }

        // Add assistant's message to conversation
        messages.push({
          role: message.role,
          content: message.content,
          tool_calls: message.tool_calls
        });

        // Check if GPT wants to call a function
        if (message.tool_calls && message.tool_calls.length > 0) {
          console.log(`🤖 GPT is making ${message.tool_calls.length} tool call(s)...`);
          
          // Execute each tool call
          for (const toolCall of message.tool_calls) {
            if (toolCall.function.name === 'web_search') {
              const args = JSON.parse(toolCall.function.arguments);
              const searchResults = await this.webSearch(args.query);
              
              // Add function result to conversation
              messages.push({
                role: "tool" as const,
                content: searchResults,
                tool_call_id: toolCall.id
              });
            }
          }
          
          currentIteration++;
          continue; // Continue the loop to get GPT's analysis after tool calls
        }

        // If no tool calls, this should be the final response
        const response = message.content;
        if (!response) {
          throw new Error('No response content from GPT');
        }

        // Parse the JSON response
        const analysis = JSON.parse(response);
        
        // Validate the response structure
        if (!analysis.gpt_analysis || typeof analysis.risk_score !== 'number') {
          throw new Error('Invalid GPT response structure');
        }

        // Return the completed analysis
        return {
          gpt_analysis: analysis.gpt_analysis,
          risk_score: Math.min(100, Math.max(0, analysis.risk_score)),
          key_findings: analysis.key_findings || [],
          recommendations: analysis.recommendations || []
        };
      }

      // If we reach here, we've exceeded max iterations
      console.warn('⚠️ Max iterations reached for GPT function calling, falling back to basic analysis');
      throw new Error('GPT took too many iterations - falling back to basic analysis');

    } catch (error: any) {
      console.error('GPT analysis error:', error.message);
      
      // Fallback analysis
      return this.generateFallbackAssetAnalysis(combinedData);
    }
  }

  /**
   * Build prompt for GPT asset analysis (multi-chain)
   */
  private buildAssetAnalysisPrompt(data: any): string {
    const { totalPortfolioValue, assetCount, assets, chainData, multiChain, pnl } = data;
    
    let prompt = `MULTI-CHAIN WALLET ASSET ANALYSIS REQUEST

PORTFOLIO OVERVIEW:
- Total Portfolio Value: $${(totalPortfolioValue || 0).toLocaleString()}
- Number of Assets: ${assetCount}
- Active Chains: ${multiChain.activeChains.join(', ').toUpperCase()}
- Total Chains: ${multiChain.totalChains}`;

    // Add P&L if available
    if (pnl && pnl.total_realized_profit_percentage !== undefined) {
      prompt += `\n- Trading Performance: ${pnl.total_realized_profit_percentage.toFixed(2)}% (${pnl.total_realized_profit_usd >= 0 ? '+' : ''}$${Number(pnl.total_realized_profit_usd).toLocaleString()})`;
      prompt += `\n- Total Trades: ${pnl.total_count_of_trades || 0}`;
    }

    prompt += `\n\nMULTI-CHAIN BREAKDOWN:`;
    for (const [chain, data] of Object.entries(chainData)) {
      const chainInfo = data as any;
      prompt += `\n- ${chain.toUpperCase()}: $${(chainInfo.netWorth || 0).toLocaleString()} (${chainInfo.tokenCount} tokens, ${(chainInfo.nativeBalance || 0).toFixed(4)} native)`;
    }

    prompt += `\n\nTOP ASSETS BY VALUE:`;

    // Show top 15 assets by value with chain info
    const topAssets = assets.slice(0, 15);
    for (const asset of topAssets) {
      prompt += `\n- ${asset.symbol} [${asset.chain?.toUpperCase() || 'Unknown'}]: $${(asset.valueUSD || 0).toLocaleString()} (${(asset.percentage || 0).toFixed(1)}%)`;
      if (asset.type === 'defi') prompt += ` [DeFi: ${asset.protocol}]`;
      if (asset.type === 'native') prompt += ` [Native Token]`;
      if (asset.possibleSpam) prompt += ` [⚠️ POTENTIAL SPAM]`;
      if (!asset.verified && asset.type !== 'native') prompt += ` [❓ UNVERIFIED]`;
    }

    if (assets.length > 15) {
      prompt += `\n... and ${assets.length - 15} more assets`;
    }

    prompt += `\n\nASSET BREAKDOWN BY TYPE:`;
    const typeBreakdown = assets.reduce((acc: any, asset: any) => {
      acc[asset.type] = (acc[asset.type] || 0) + 1;
      return acc;
    }, {});
    
    for (const [type, count] of Object.entries(typeBreakdown)) {
      prompt += `\n- ${type}: ${count} assets`;
    }

    prompt += `\n\nASSET BREAKDOWN BY CHAIN:`;
    const chainBreakdown = assets.reduce((acc: any, asset: any) => {
      const chain = asset.chain || 'unknown';
      acc[chain] = (acc[chain] || 0) + 1;
      return acc;
    }, {});
    
    for (const [chain, count] of Object.entries(chainBreakdown)) {
      prompt += `\n- ${chain.toUpperCase()}: ${count} assets`;
    }

    // Add concentration analysis
    const top1Percent = assets[0]?.percentage || 0;
    const top3Percent = assets.slice(0, 3).reduce((sum: number, asset: any) => sum + asset.percentage, 0);
    
    prompt += `\n\nCONCENTRATION ANALYSIS:
- Largest position: ${top1Percent.toFixed(1)}%
- Top 3 positions: ${top3Percent.toFixed(1)}%`;

    // Multi-chain diversification analysis
    const chainDiversification = multiChain.totalChains > 1 ? 'Good' : 'Poor';
    prompt += `\n- Chain diversification: ${chainDiversification} (${multiChain.totalChains} chains)`;

    // Add suspicious tokens
    const suspiciousTokens = assets.filter((asset: any) => 
      asset.possibleSpam || 
      (!asset.verified && asset.type !== 'native') || 
      this.knowledgeBase.riskIndicators.scamPatterns.some(pattern => 
        asset.symbol.toLowerCase().includes(pattern.toLowerCase())
      )
    );

    if (suspiciousTokens.length > 0) {
      prompt += `\n\nSUSPICIOUS TOKENS DETECTED:`;
      for (const token of suspiciousTokens.slice(0, 8)) {
        prompt += `\n- ${token.symbol} [${token.chain?.toUpperCase()}]: ${token.possibleSpam ? 'Marked as spam, ' : ''}${!token.verified && token.type !== 'native' ? 'Unverified contract' : ''}`;
      }
    }

    // DeFi positions
    const defiAssets = assets.filter((asset: any) => asset.type === 'defi');
    if (defiAssets.length > 0) {
      prompt += `\n\nDEFI POSITIONS:`;
      for (const defi of defiAssets.slice(0, 5)) {
        prompt += `\n- ${defi.protocol}: $${(defi.valueUSD || 0).toLocaleString()}`;
      }
    }

    prompt += `\n\nPlease analyze this MULTI-CHAIN portfolio for asset-related risks, focusing on:
1. Token legitimacy and scam detection across all chains
2. Portfolio concentration and diversification (including chain diversification)
3. Asset quality and establishment level
4. Multi-chain security considerations
5. Cross-chain bridge risks and exposures
6. Overall risk assessment considering multi-chain complexity

Provide specific actionable recommendations for risk mitigation across all active chains.`;

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
      gpt_analysis: `Automated analysis of wallet assets. Portfolio contains ${assetCount} assets worth $${(totalPortfolioValue || 0).toLocaleString()}. ${keyFindings.length > 0 ? keyFindings.join('. ') + '.' : 'No major issues detected.'}`,
      risk_score: riskScore,
      key_findings: keyFindings,
      recommendations: recommendations
    };
  }
}

export default AssetAnalyzer;
