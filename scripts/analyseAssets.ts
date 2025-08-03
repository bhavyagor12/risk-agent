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

  // Simplified weighted scoring system (quantity-based)
  private weights = {
    scamTokenQuantity: 2,      // 2 points per scam token (mild penalty)
    verifiedToken: -1,         // 1 point reduction per verified token
    establishedToken: -2,      // 2 points reduction per established token
    tokenDiversity: -1,        // Bonus for having many different tokens
    overDiversification: 1     // Small penalty for too many tokens (>100)
  };

  // Airdrop claim detection - claims before this date are likely scams
  private SUSPICIOUS_AIRDROP_DATE = new Date('2022-01-01'); // Adjust as needed

  // Deterministic knowledge base for GPT context
  private knowledgeBase = {
    stableTokens: [
      'USDT', 'USDC', 'DAI', 'BUSD', 'FRAX', 'TUSD', 'USDP', 'LUSD', 'MIM'
    ],
    establishedTokens: [
      'BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'XRP', 'AVAX', 'DOT', 'MATIC', 'LINK',
      'UNI', 'AAVE', 'CRV', 'COMP', 'MKR', 'SNX', 'YFI', 'SUSHI', 'GRT', 'ENS',
      'WETH', 'WBTC', 'WUSDC', 'WUSDT', 'WDAI', 'LDO', 'ARB', 'OP', 'STETH',
      'RPL', '1INCH', 'BAL', 'GMX', 'DYDX', 'INJ', 'FTM', 'NEAR', 'KAVA',
      'NEXO', 'ANKR', 'CAKE', 'ZRX', 'BAT', 'RUNE', 'TWT', 'OCEAN', 'AGIX',
      'APE', 'PEPE', 'DOGE', 'SHIB', 'TIA', 'SEI', 'JUP', 'PYTH', 'WTAO', 'EIGEN',
      'TRX', 'BCH', 'XMR', 'SAROS', 'XCN', 'ZBCN', 'SYRUP', 'LOCK',
      'aEthUNI',
      'aEthLINK',
      'aEthAAVE',
      'aEthDAI',
      'aEthUSDC',
      'aEthWBTC',
      'aEthWETH',
      'cbETH',   
      'cbBTC',
      'cbUSDC',
      'rETH',      
      'wstETH',    
      'sDAI',      
      'eUSD',      
      'weETH',     
      'ETHx',      
    ],
    riskIndicators: {
      scamPatterns: [
        'test', 'fake', 'scam', 'moon', 'safe', 'inu', 'elon', 'pump', 'rug',
        'airdrop', 'giveaway', 'shiba', 'baby', 'pepe', 'token', 'launch', 'zero tax'
      ],
      highRiskFactors: [
        'low market cap', 'new token', 'unverified contract', 'high concentration',
        'no audit', 'anon team', 'suspicious ownership', 'limited holders',
        'no real utility', 'recent deploy', 'no social presence', 'fake liquidity',
        'no locked liquidity', 'price manipulation', 'sudden volume spikes'
      ],
      positiveFactors: [
        'blue chip token', 'established protocol', 'high liquidity',
        'good diversification', 'audited contract', 'large holder base',
        'active development', 'transparent team', 'onchain reputation',
        'liquidity locked', 'real-world utility', 'listed on major CEXes',
        'long track record'
      ]
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
            profit_loss: moralisData.ethereum.profitLoss,
            profitability: moralisData.ethereum.profitability,
            swaps: moralisData.ethereum.swaps,
            approvals: moralisData.ethereum.approvals
          },
          base: {
            token_balances: moralisData.base.tokenBalances,
            native_balance: moralisData.base.nativeBalance,
            net_worth: moralisData.base.netWorth,
            profitability: moralisData.base.profitability,
            swaps: moralisData.base.swaps,
            approvals: moralisData.base.approvals
          },
          polygon: {
            token_balances: moralisData.polygon.tokenBalances,
            native_balance: moralisData.polygon.nativeBalance,
            net_worth: moralisData.polygon.netWorth,
            profitability: moralisData.polygon.profitability,
            swaps: moralisData.polygon.swaps,
            approvals: moralisData.polygon.approvals
          },
          combined_metrics: {
            ...moralisData.combinedMetrics,
            total_net_worth_usd: moralisData.combinedMetrics.totalNetWorth // Ensure consistent storage
          }
        });
      }

      // Structure data for GPT analysis
      const combinedAssetData = this.combineMultiChainAssetData(moralisData);

      // Calculate baseline weighted score for reference
      const baselineScoring = this.calculateWeightedRiskScore(combinedAssetData);
      
      // Generate GPT analysis (with baseline score as context)
      const gptAnalysis = await this.generateGPTAssetAnalysis(combinedAssetData, baselineScoring);

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
    // Handle flexible data structure - try both raw API data and processed data
    const getTokenBalances = (chain: string) => {
      return moralisRawData[`raw_${chain}_token_balances`]?.result ||
        moralisRawData[`raw_${chain}_token_balances`] ||
        moralisRawData[chain]?.token_balances?.result ||
        moralisRawData[chain]?.token_balances ||
        [];
    };

    const getNativeBalance = (chain: string) => {
      return moralisRawData[`raw_${chain}_native_balance`] ||
        moralisRawData[chain]?.native_balance ||
        { balance: '0', balance_formatted: '0' };
    };

    const getNetWorth = (chain: string) => {
      return moralisRawData.raw_multi_chain_net_worth ||
        moralisRawData[chain]?.net_worth ||
        { total_networth_usd: '0', chains: [] };
    };

    // Extract token balances for calculation
    const ethTokenBalances = getTokenBalances('ethereum');
    const baseTokenBalances = getTokenBalances('base');
    const polygonTokenBalances = getTokenBalances('polygon');

    // Calculate combined metrics
    const totalNetWorth = parseFloat(moralisRawData.raw_multi_chain_net_worth?.total_networth_usd ||
      moralisRawData.combined_metrics?.total_net_worth_usd || '0');

    const totalTokenCount = ethTokenBalances.length + baseTokenBalances.length + polygonTokenBalances.length;

    return {
      ethereum: {
        tokenBalances: ethTokenBalances,
        nativeBalance: getNativeBalance('ethereum'),
        netWorth: getNetWorth('ethereum'),
        portfolio: moralisRawData.raw_ethereum_portfolio || moralisRawData.ethereum?.portfolio || { totalValue: 0 },
        profitLoss: moralisRawData.raw_ethereum_profit_loss || moralisRawData.ethereum?.profit_loss || {},
        profitability: moralisRawData.ethereum?.profitability || {},
        swaps: moralisRawData.ethereum?.swaps || [],
        approvals: moralisRawData.ethereum?.approvals || []
      },
      base: {
        tokenBalances: baseTokenBalances,
        nativeBalance: getNativeBalance('base'),
        netWorth: getNetWorth('base'),
        profitability: moralisRawData.base?.profitability || {},
        swaps: moralisRawData.base?.swaps || [],
        approvals: moralisRawData.base?.approvals || []
      },
      polygon: {
        tokenBalances: polygonTokenBalances,
        nativeBalance: getNativeBalance('polygon'),
        netWorth: getNetWorth('polygon'),
        profitability: moralisRawData.polygon?.profitability || {},
        swaps: moralisRawData.polygon?.swaps || [],
        approvals: moralisRawData.polygon?.approvals || []
      },
      combinedMetrics: moralisRawData.combined_metrics || {
        totalNetWorth,
        total_net_worth_usd: totalNetWorth,
        totalTokenCount,
        chainsWithActivity: [
          ethTokenBalances.length > 0 || parseFloat(getNativeBalance('ethereum').balance_formatted || '0') > 0 ? 'ethereum' : null,
          baseTokenBalances.length > 0 || parseFloat(getNativeBalance('base').balance_formatted || '0') > 0 ? 'base' : null,
          polygonTokenBalances.length > 0 || parseFloat(getNativeBalance('polygon').balance_formatted || '0') > 0 ? 'polygon' : null
        ].filter(Boolean)
      },
      // Include all raw data for GPT processing
      rawData: moralisRawData
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
        ethTokenBalances, ethNativeBalance, ethPortfolio, ethProfitLoss, ethProfitability, ethSwaps, ethApprovals,
        // Base data
        baseTokenBalances, baseNativeBalance, baseProfitability, baseSwaps, baseApprovals,
        // Polygon data
        polygonTokenBalances, polygonNativeBalance, polygonProfitability, polygonSwaps, polygonApprovals,
        // Multi-chain net worth (single call for all chains)
        multiChainNetWorth
      ] = await Promise.all([
        // Ethereum
        this.moralisAPI.getTokenBalances(address, 'eth'),
        this.moralisAPI.getNativeBalance(address, 'eth'),
        this.moralisAPI.getWalletPortfolio(address, 'eth'),
        this.moralisAPI.getProfitAndLoss(address, 'eth'),
        this.moralisAPI.getWalletProfitability(address, 'eth'),
        this.moralisAPI.getWalletSwaps(address, 'eth', 50),
        this.moralisAPI.getWalletApprovals(address, 'eth', 50),
        // Base
        this.moralisAPI.getTokenBalances(address, 'base'),
        this.moralisAPI.getNativeBalance(address, 'base'),
        this.moralisAPI.getWalletProfitability(address, 'base'),
        this.moralisAPI.getWalletSwaps(address, 'base', 50),
        this.moralisAPI.getWalletApprovals(address, 'base', 50),
        // Polygon
        this.moralisAPI.getTokenBalances(address, 'polygon'),
        this.moralisAPI.getNativeBalance(address, 'polygon'),
        this.moralisAPI.getWalletProfitability(address, 'polygon'),
        this.moralisAPI.getWalletSwaps(address, 'polygon', 50),
        this.moralisAPI.getWalletApprovals(address, 'polygon', 50),
        // Multi-chain net worth (single API call - gets all chains by default)
        this.moralisAPI.getNetWorth(address)
      ]);

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

      const totalTokenCount = ((ethTokenBalances as any)?.result?.length || ethTokenBalances?.length || 0) +
        ((baseTokenBalances as any)?.result?.length || baseTokenBalances?.length || 0) +
        ((polygonTokenBalances as any)?.result?.length || polygonTokenBalances?.length || 0);

      return {
        ethereum: {
          tokenBalances: ethTokenBalances,
          nativeBalance: ethNativeBalance,
          netWorth: ethNetWorth,
          portfolio: ethPortfolio,
          profitLoss: ethProfitLoss,
          profitability: ethProfitability,
          swaps: ethSwaps,
          approvals: ethApprovals
        },
        base: {
          tokenBalances: baseTokenBalances,
          nativeBalance: baseNativeBalance,
          netWorth: baseNetWorth,
          profitability: baseProfitability,
          swaps: baseSwaps,
          approvals: baseApprovals
        },
        polygon: {
          tokenBalances: polygonTokenBalances,
          nativeBalance: polygonNativeBalance,
          netWorth: polygonNetWorth,
          profitability: polygonProfitability,
          swaps: polygonSwaps,
          approvals: polygonApprovals
        },
        combinedMetrics: {
          totalNetWorth,
          total_net_worth_usd: totalNetWorth, // Store both formats for consistency
          totalTokenCount,
          chainsWithActivity: [
            ((ethTokenBalances as any)?.result?.length || ethTokenBalances?.length || 0) > 0 || parseFloat(ethNativeBalance?.balance_formatted || '0') > 0 ? 'ethereum' : null,
            ((baseTokenBalances as any)?.result?.length || baseTokenBalances?.length || 0) > 0 || parseFloat(baseNativeBalance?.balance_formatted || '0') > 0 ? 'base' : null,
            ((polygonTokenBalances as any)?.result?.length || polygonTokenBalances?.length || 0) > 0 || parseFloat(polygonNativeBalance?.balance_formatted || '0') > 0 ? 'polygon' : null
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
          profitLoss: {},
          profitability: {},
          swaps: [],
          approvals: []
        },
        base: {
          tokenBalances: [],
          nativeBalance: { balance: '0', balance_formatted: '0' },
          netWorth: { total_networth_usd: '0', chains: [] },
          profitability: {},
          swaps: [],
          approvals: []
        },
        polygon: {
          tokenBalances: [],
          nativeBalance: { balance: '0', balance_formatted: '0' },
          netWorth: { total_networth_usd: '0', chains: [] },
          profitability: {},
          swaps: [],
          approvals: []
        },
        combinedMetrics: {
          totalNetWorth: 0,
          total_net_worth_usd: 0,
          totalTokenCount: 0,
          chainsWithActivity: []
        }
      };
    }
  }

  /**
   * Combine multi-chain asset data from Moralis (simplified quantity-based approach)
   */
  private combineMultiChainAssetData(moralisData: any) {
    const assets = [];
    const chainData: { [key: string]: any } = {};

    console.log(`🔍 Starting simplified token analysis - focusing on quantities and diversity`);

    // Process each chain
    const chains = ['ethereum', 'base', 'polygon'];

    for (const chain of chains) {
      const chainInfo = moralisData[chain];
      if (!chainInfo) continue;

      chainData[chain] = {
        nativeBalance: parseFloat(chainInfo.nativeBalance?.balance_formatted || '0'),
        tokenCount: chainInfo.tokenBalances?.length || 0
      };

      // Add native token (ETH, BASE ETH, MATIC) if balance > 0
      if (parseFloat(chainInfo.nativeBalance?.balance_formatted || '0') > 0) {
        const nativeSymbol = chain === 'ethereum' ? 'ETH' : chain === 'base' ? 'ETH' : 'MATIC';
        
        assets.push({
          source: 'moralis',
          chain: chain,
          symbol: nativeSymbol,
          balance: chainData[chain].nativeBalance,
          type: 'native',
          contractAddress: 'native',
          verified: true,
          possibleSpam: false,
          isEstablished: true
        });
      }

      // Add token balances (simplified - no price calculations)
      for (const token of chainInfo.tokenBalances || []) {
        if (parseFloat(token.balance) > 0 && token.symbol) { // Skip tokens with null symbols
          const tokenBalance = parseFloat(token.balance) / Math.pow(10, token.decimals);
          
          // Check if this token is established
          const isEstablished = this.isEstablishedToken(token.symbol);
          
          // Simple airdrop/scam detection
          const hasLowBalance = tokenBalance < 0.001; // Very small balance
          const isLikelyAirdrop = this.isLikelyAirdropScam(token, chainInfo);
          
          assets.push({
            source: 'moralis',
            chain: chain,
            symbol: token.symbol,
            name: token.name,
            balance: tokenBalance,
            type: 'token',
            contractAddress: token.token_address,
            verified: token.verified_contract || false,
            possibleSpam: token.possible_spam || false,
            isEstablished: isEstablished,
            hasLowBalance: hasLowBalance,
            isLikelyAirdrop: isLikelyAirdrop
          });
        }
      }
    }

    // Add DeFi positions from Ethereum portfolio (simplified)
    if (moralisData.ethereum.portfolio && moralisData.ethereum.portfolio.defiPositions) {
      for (const defiPos of moralisData.ethereum.portfolio.defiPositions) {
        assets.push({
          source: 'moralis',
          chain: 'ethereum',
          symbol: defiPos.protocol_name || 'DeFi Position',
          type: 'defi',
          protocol: defiPos.protocol_name,
          verified: true,
          possibleSpam: false,
          isEstablished: true
        });
      }
    }

    // Sort by token type priority: native > established > verified > others
    const sortedAssets = assets.sort((a, b) => {
      const priorityA = a.type === 'native' ? 0 : a.isEstablished ? 1 : a.verified ? 2 : 3;
      const priorityB = b.type === 'native' ? 0 : b.isEstablished ? 1 : b.verified ? 2 : 3;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.symbol.localeCompare(b.symbol);
    });

    console.log(`🔍 Token Analysis Summary:
    - Total Assets: ${sortedAssets.length}
    - Active Chains: ${Object.keys(chainData).length}
    - Top Assets: ${sortedAssets.slice(0, 10).map(a => `${a.symbol}(${a.chain})`).join(', ')}`);

    return {
      assetCount: sortedAssets.length,
      assets: sortedAssets,
      chainData,
      multiChain: {
        activeChains: moralisData.combinedMetrics?.chainsWithActivity || Object.keys(chainData),
        totalChains: Object.keys(chainData).length,
        totalTokenCount: sortedAssets.length
      },
      pnl: moralisData.ethereum.profitLoss || {}
    };
  }

  /**
   * Simple airdrop/scam detection based on common patterns
   */
  private isLikelyAirdropScam(token: any, chainInfo: any): boolean {
    // Check for suspicious token patterns
    const suspiciousName = this.knowledgeBase.riskIndicators.scamPatterns.some(pattern =>
      (token.symbol && token.symbol.toLowerCase().includes(pattern.toLowerCase())) ||
      (token.name && token.name.toLowerCase().includes(pattern.toLowerCase()))
    );
    
    // Check for very recent token creation (if deployment date available)
    let recentCreation = false;
    if (token.created_at || token.first_seen) {
      const creationDate = new Date(token.created_at || token.first_seen);
      const monthsAgo = new Date();
      monthsAgo.setMonth(monthsAgo.getMonth() - 1);
      recentCreation = creationDate > monthsAgo;
    }
    
    // Check if it's marked as spam by API
    const markedAsSpam = token.possible_spam === true;
    
    // Very small balance suggests airdrop
    const hasVerySmallBalance = parseFloat(token.balance) / Math.pow(10, token.decimals) < 0.001;
    
    return suspiciousName || markedAsSpam || (recentCreation && hasVerySmallBalance);
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
  private async generateGPTAssetAnalysis(combinedData: any, baselineScoring?: any): Promise<AssetAnalysisResult> {
    try {
      const prompt = this.buildAssetAnalysisPrompt(combinedData, baselineScoring);

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

CRITICAL SEARCH RESTRICTIONS:
- NEVER search for established tokens: ${this.knowledgeBase.stableTokens.join(', ')}, ${this.knowledgeBase.establishedTokens.join(', ')}
- Do NOT search for tokens with very small balances (likely airdrops) unless they have many holders
- Skip tokens created/first seen within the last month (likely new airdrops)
- Focus searches on tokens that appear to have actual trading volume or significant holders

ONLY search for tokens that:
1. Are NOT in established token lists
2. Have suspicious names but significant balances
3. Are marked as possible spam with trading activity
4. Are unverified contracts with meaningful holder counts
5. Have concerning patterns but actual usage

AIRDROP DETECTION: If a token appears to be a recent airdrop (small balance, recent creation, spam-like name), mark it as suspicious but do NOT waste web searches on it.
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

<simplified_scoring_system>
Use this SIMPLIFIED quantity-based scoring methodology:

Base Score: 40 (neutral risk level)

Risk Factors (quantity-based penalties):
- Scam Tokens: +2 points per suspected scam token
  * Reduce penalty by 50% if most are dust/airdrop tokens (tiny balances)
  * Focus on QUANTITY of suspicious tokens, not their dollar value
- Over-diversification: +1 point per token above 100 total tokens (max +15)
- Under-diversification: +5 points if fewer than 3 meaningful tokens

Positive Factors (quantity-based bonuses):
- Established Tokens: -2 points per established token (USDT, ETH, BTC, etc.)
- Verified Tokens: -1 point per additional verified token (beyond established)
- Token Diversity: -1 point per meaningful token (5-20 range optimal)
- Multi-chain: -3 points for multi-chain diversification
- DeFi Participation: -2 points for DeFi positions

Key Principles:
1. IGNORE dollar values completely - focus only on token quantities and types
2. Mild penalties for scam tokens (they might be unwanted airdrops)
3. Reward established token holdings and diversity
4. Don't over-penalize users for receiving airdropped junk tokens
5. Simple, transparent scoring based on what users can control

Final Score Ranges:
- 0-25: Very Low Risk (mostly established tokens, good diversity)
- 26-40: Low Risk (decent token selection, some established)
- 41-55: Medium Risk (mixed portfolio, balanced risk factors)
- 56-70: High Risk (many suspicious tokens, poor diversity)
- 71-100: Very High Risk (dominated by scam tokens, bad token selection)

CRITICAL: This is a QUANTITY-based system. Don't worry about token prices or portfolio percentages - just count how many tokens of each type the user holds.
</simplified_scoring_system>

<examples>
<example>
<scenario>Wallet with 3 established tokens (ETH, USDC, UNI) + 50 airdropped dust tokens</scenario>
<expected_analysis>Good core token selection with many airdropped dust tokens</expected_analysis>
<expected_risk_score>38</expected_risk_score>
<expected_findings>["3 established tokens (-6 points)", "50 suspected scam tokens mostly dust (+50 points)", "Multi-chain diversification (-3 points)"]</expected_findings>
</example>

<example>
<scenario>Wallet with 1 established token (ETH) + 10 meaningful scam tokens with trading activity</scenario>
<expected_analysis>Limited diversity with concerning scam token holdings</expected_analysis>
<expected_risk_score>55</expected_risk_score>
<expected_findings>["1 established token (-2 points)", "10 suspected scam tokens (+20 points)", "Limited token diversity (+5 points)"]</expected_findings>
</example>

<example>
<scenario>Wallet with 8 established tokens + 5 verified tokens + 2 DeFi positions</scenario>
<expected_analysis>Excellent token selection with strong diversification</expected_analysis>
<expected_risk_score>18</expected_risk_score>
<expected_findings>["8 established tokens (-16 points)", "5 verified tokens (-5 points)", "Good token diversity (-8 points)", "DeFi participation (-2 points)"]</expected_findings>
</example>
</examples>

<output_format>
CRITICAL: After completing your analysis (including any web searches), you must respond with valid JSON only. Do not include any text before or after the JSON:
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
  private buildAssetAnalysisPrompt(data: any, baselineScoring?: any): string {
    const { assetCount, assets, chainData, multiChain, pnl } = data;

    console.log(`🔍 Starting simplified prompt building: ${assetCount} assets across ${multiChain.totalChains} chains`);

    let prompt = `SIMPLIFIED MULTI-CHAIN WALLET TOKEN ANALYSIS REQUEST

TOKEN OVERVIEW:
- Total Tokens: ${assetCount}
- Active Chains: ${multiChain.activeChains.join(', ').toUpperCase()}
- Chain Count: ${multiChain.totalChains}`;

    // Add baseline scoring reference if available
    if (baselineScoring) {
      prompt += `\n\nBASELINE QUANTITY-BASED RISK SCORE: ${Math.round(baselineScoring.score)}/100`;
      prompt += `\nScoring Breakdown:`;
      prompt += `\n- Total Tokens: ${baselineScoring.details.totalTokens}`;
      prompt += `\n- Suspected Scam Tokens: ${baselineScoring.details.scamTokenCount}`;
      prompt += `\n- Established Tokens: ${baselineScoring.details.establishedTokens}`;
      prompt += `\n- Verified Tokens: ${baselineScoring.details.verifiedTokens}`;
      prompt += `\nKey Factors: ${baselineScoring.factors.slice(0, 3).join(', ')}`;
    }

    // Add multi-chain profitability data
    const chains = ['ethereum', 'base', 'polygon'];
    const profitabilityData = [];
    const swapsData = [];
    const approvalsData = [];

    for (const chain of chains) {
      const chainInfo = data[chain];
      if (!chainInfo) continue;

      // Profitability data
      if (chainInfo.profitability && chainInfo.profitability.total_profit_usd !== undefined) {
        profitabilityData.push({
          chain,
          totalProfit: chainInfo.profitability.total_profit_usd,
          totalTrades: chainInfo.profitability.total_count_of_trades || 0,
          profitPercentage: chainInfo.profitability.total_profit_percentage || 0
        });
      }

      // Swaps data
      if (chainInfo.swaps && chainInfo.swaps.length > 0) {
        swapsData.push({
          chain,
          swapCount: chainInfo.swaps.length,
          recentSwaps: chainInfo.swaps.slice(0, 3).map((swap: any) => ({
            tokenIn: swap.token_0_symbol || 'Unknown',
            tokenOut: swap.token_1_symbol || 'Unknown',
            timestamp: swap.block_timestamp
          }))
        });
      }

      // Approvals data  
      if (chainInfo.approvals && chainInfo.approvals.length > 0) {
        approvalsData.push({
          chain,
          approvalCount: chainInfo.approvals.length,
          protocols: chainInfo.approvals.slice(0, 5).map((approval: any) =>
            approval.spender_name || approval.spender_address?.slice(0, 8) || 'Unknown'
          )
        });
      }
    }

    if (profitabilityData.length > 0) {
      prompt += `\n\nMULTI-CHAIN PROFITABILITY:`;
      for (const profit of profitabilityData) {
        prompt += `\n- ${profit.chain.toUpperCase()}: ${profit.profitPercentage.toFixed(2)}% (${profit.totalTrades} trades, $${profit.totalProfit.toLocaleString()})`;
      }
    }

    if (swapsData.length > 0) {
      prompt += `\n\nRECENT TRADING ACTIVITY:`;
      for (const swapInfo of swapsData) {
        prompt += `\n- ${swapInfo.chain.toUpperCase()}: ${swapInfo.swapCount} swaps`;
        if (swapInfo.recentSwaps.length > 0) {
          const recentSwapsSummary = swapInfo.recentSwaps.map((s: any) => `${s.tokenIn}→${s.tokenOut}`).join(', ');
          prompt += ` (Recent: ${recentSwapsSummary})`;
        }
      }
    }

    if (approvalsData.length > 0) {
      prompt += `\n\nTOKEN APPROVALS:`;
      for (const approvalInfo of approvalsData) {
        prompt += `\n- ${approvalInfo.chain.toUpperCase()}: ${approvalInfo.approvalCount} active approvals`;
        if (approvalInfo.protocols.length > 0) {
          prompt += ` (Protocols: ${approvalInfo.protocols.join(', ')})`;
        }
      }
    }

    prompt += `\n\nCHAIN BREAKDOWN:`;
    for (const [chain, data] of Object.entries(chainData)) {
      const chainInfo = data as any;
      prompt += `\n- ${chain.toUpperCase()}: ${chainInfo.tokenCount} tokens${chainInfo.nativeBalance > 0 ? ' (includes native)' : ''}`;
    }

    // Token classification
    const establishedTokens = assets.filter((asset: any) => asset.isEstablished);
    const verifiedTokens = assets.filter((asset: any) => asset.verified && !asset.isEstablished);
    const suspiciousTokens = assets.filter((asset: any) => asset.possibleSpam || asset.isLikelyAirdrop);
    const unverifiedTokens = assets.filter((asset: any) => !asset.verified && !asset.isEstablished && asset.type !== 'native');

    prompt += `\n\nTOKEN CLASSIFICATION:`;
    if (establishedTokens.length > 0) {
      prompt += `\n- ESTABLISHED (${establishedTokens.length}): ${establishedTokens.slice(0, 10).map((t: any) => `${t.symbol}[${t.chain}]`).join(', ')}`;
      if (establishedTokens.length > 10) prompt += ` ... and ${establishedTokens.length - 10} more`;
    }
    
    if (verifiedTokens.length > 0) {
      prompt += `\n- VERIFIED (${verifiedTokens.length}): ${verifiedTokens.slice(0, 8).map((t: any) => `${t.symbol}[${t.chain}]`).join(', ')}`;
      if (verifiedTokens.length > 8) prompt += ` ... and ${verifiedTokens.length - 8} more`;
    }

    if (suspiciousTokens.length > 0) {
      prompt += `\n- SUSPICIOUS (${suspiciousTokens.length}): ${suspiciousTokens.slice(0, 10).map((t: any) => `${t.symbol}[${t.chain}]${t.hasLowBalance ? '*dust' : ''}`).join(', ')}`;
      if (suspiciousTokens.length > 10) prompt += ` ... and ${suspiciousTokens.length - 10} more`;
    }

    if (unverifiedTokens.length > 0) {
      prompt += `\n- UNVERIFIED (${unverifiedTokens.length}): ${unverifiedTokens.slice(0, 8).map((t: any) => `${t.symbol}[${t.chain}]`).join(', ')}`;
      if (unverifiedTokens.length > 8) prompt += ` ... and ${unverifiedTokens.length - 8} more`;
    }

    // DeFi positions
    const defiAssets = assets.filter((asset: any) => asset.type === 'defi');
    if (defiAssets.length > 0) {
      prompt += `\n\nDEFI POSITIONS (${defiAssets.length}):`;
      for (const defi of defiAssets) {
        prompt += `\n- ${defi.protocol || defi.symbol}`;
      }
    }

    prompt += `\n\nPlease analyze this SIMPLIFIED multi-chain token portfolio focusing on QUANTITIES, not values:

1. Token Quality Assessment (quantity-based):
   - Count established vs suspicious tokens
   - Assess token diversity and selection quality
   - Identify likely airdropped vs intentionally acquired tokens

2. Risk Factors (simple counting):
   - How many suspected scam/spam tokens?
   - Are most suspicious tokens dust/airdrops (tiny balances)?
   - Token diversity: too few meaningful tokens vs over-diversification?

3. Positive Factors (simple counting):
   - How many established tokens (ETH, USDC, etc.)?
   - How many verified contracts?
   - Multi-chain diversification present?
   - Any DeFi participation?

CRITICAL INSTRUCTIONS:
- IGNORE all dollar values and percentages - focus only on TOKEN COUNTS
- Use the simplified quantity-based scoring system provided
- Mild penalties for scam tokens (they might be unwanted airdrops)
- Don't search the web for obvious dust/airdrop tokens with tiny balances
- Refer to baseline score but adjust based on your token counting analysis
- Be reasonable: 50 airdropped spam tokens shouldn't destroy a good portfolio score

Your analysis should be based on what tokens the user chose to acquire vs what was airdropped to them.`;

    return prompt;
  }

  /**
   * Normalize token symbol for comparison (handle Unicode lookalikes)
   */
  private normalizeTokenSymbol(symbol: string): string {
    if (!symbol) return '';
    
    // Handle common Unicode lookalikes
    return symbol
      .replace(/[СĆĈĊČ]/g, 'C')  // Cyrillic and accented C variants
      .replace(/[ÈÉÊËĒĔĖĘĚЕё]/g, 'E')  // Various E variants
      .replace(/[ТΤ]/g, 'T')  // Cyrillic/Greek T
      .replace(/[АΑ]/g, 'A')  // Cyrillic/Greek A
      .replace(/[ΗН]/g, 'H')  // Greek/Cyrillic H
      .replace(/[РΡ]/g, 'P')  // Cyrillic/Greek P
      .replace(/[ОΟО]/g, 'O')  // Various O variants
      .replace(/[ХΧ]/g, 'X')  // Cyrillic/Greek X
      .replace(/[МΜ]/g, 'M')  // Cyrillic/Greek M
      .replace(/[ВΒ]/g, 'B')  // Cyrillic/Greek B
      .replace(/[КΚ]/g, 'K')  // Cyrillic/Greek K
      .replace(/[НΗ]/g, 'H')  // Cyrillic/Greek H
      .replace(/[ЯΡ]/g, 'R')  // Handle R variants
      .toUpperCase()
      .trim();
  }

  /**
   * Check if token is established/stable using normalized symbols
   */
  private isEstablishedToken(symbol: string): boolean {
    const normalizedSymbol = this.normalizeTokenSymbol(symbol);
    return [...this.knowledgeBase.establishedTokens, ...this.knowledgeBase.stableTokens]
      .some(token => this.normalizeTokenSymbol(token) === normalizedSymbol);
  }

  /**
   * Calculate simplified quantity-based risk score
   */
  private calculateWeightedRiskScore(data: any): { score: number, factors: string[], details: any } {
    const { assetCount, assets } = data;
    
    let baseScore = 0;
    const factors: string[] = [];
    const details: any = {
      scamTokens: [],
      establishedTokens: 0,
      verifiedTokens: 0,
      totalTokens: assetCount,
      scamTokenCount: 0
    };

    // 1. Count different types of tokens
    const scamTokens = assets.filter((asset: any) => {
      // Skip established tokens from scam detection
      if (asset.isEstablished) return false;
      
      // Check for scam indicators
      return asset.possibleSpam || asset.isLikelyAirdrop || 
        this.knowledgeBase.riskIndicators.scamPatterns.some(pattern =>
          asset.symbol && asset.symbol.toLowerCase().includes(pattern.toLowerCase())
        );
    });

    const establishedTokens = assets.filter((asset: any) => asset.isEstablished);
    const verifiedTokens = assets.filter((asset: any) => asset.verified && !asset.isEstablished);
    const nativeTokens = assets.filter((asset: any) => asset.type === 'native');
    const defiPositions = assets.filter((asset: any) => asset.type === 'defi');

    // 2. Scam Token Penalty (mild, quantity-based)
    if (scamTokens.length > 0) {
      let scamPenalty = scamTokens.length * this.weights.scamTokenQuantity;
      
      // Reduce penalty if most are likely airdrops with tiny balances
      const dustTokens = scamTokens.filter((token: any) => token.hasLowBalance);
      const airdropTokens = scamTokens.filter((token: any) => token.isLikelyAirdrop);
      
      if (dustTokens.length >= scamTokens.length * 0.8) {
        scamPenalty *= 0.5; // 50% reduction for mostly dust
        factors.push(`${scamTokens.length} suspected scam tokens (mostly dust/airdrops)`);
      } else {
        factors.push(`${scamTokens.length} suspected scam tokens detected`);
      }
      
      baseScore += scamPenalty;
      details.scamTokenCount = scamTokens.length;
      details.scamTokens = scamTokens.map((token: any) => ({
        symbol: token.symbol,
        chain: token.chain,
        isLikelyAirdrop: token.isLikelyAirdrop,
        hasLowBalance: token.hasLowBalance
      }));
    }

    // 3. Established Token Bonus
    if (establishedTokens.length > 0) {
      const establishedBonus = Math.min(20, establishedTokens.length * Math.abs(this.weights.establishedToken));
      baseScore += this.weights.establishedToken * establishedTokens.length;
      details.establishedTokens = establishedTokens.length;
      factors.push(`${establishedTokens.length} established tokens (${establishedBonus} risk reduction)`);
    }

    // 4. Verified Token Bonus
    if (verifiedTokens.length > 0) {
      const verifiedBonus = Math.min(15, verifiedTokens.length * Math.abs(this.weights.verifiedToken));
      baseScore += this.weights.verifiedToken * verifiedTokens.length;
      details.verifiedTokens = verifiedTokens.length;
      factors.push(`${verifiedTokens.length} additional verified tokens (${verifiedBonus} risk reduction)`);
    }

    // 5. Token Diversity Analysis
    const meaningfulTokens = assets.filter((asset: any) => 
      !asset.hasLowBalance && !asset.isLikelyAirdrop
    ).length;
    
    if (meaningfulTokens >= 5 && meaningfulTokens <= 20) {
      baseScore += this.weights.tokenDiversity * Math.min(10, meaningfulTokens);
      factors.push(`Good token diversity (${meaningfulTokens} meaningful tokens)`);
    } else if (meaningfulTokens < 3) {
      baseScore += 5; // Small penalty for low diversity
      factors.push(`Limited token diversity (${meaningfulTokens} meaningful tokens)`);
    }

    // 6. Over-diversification Penalty
    if (assetCount > 100) {
      const overDiversificationPenalty = Math.min(15, (assetCount - 100) * this.weights.overDiversification);
      baseScore += overDiversificationPenalty;
      factors.push(`Over-diversified portfolio (${assetCount} total tokens)`);
    } else if (assetCount > 50) {
      baseScore += 5; // Small penalty
      factors.push(`High token count (${assetCount} total tokens)`);
    }

    // 7. Multi-chain bonus
    const multiChain = data.multiChain;
    if (multiChain.totalChains > 1) {
      baseScore -= 3; // Small bonus for multi-chain diversification
      factors.push(`Multi-chain diversification (${multiChain.totalChains} chains)`);
    }

    // 8. DeFi participation bonus
    if (defiPositions.length > 0) {
      baseScore -= 2; // Small bonus for DeFi engagement
      factors.push(`DeFi participation (${defiPositions.length} positions)`);
    }

    // Calculate final score (base 40 for neutral risk)
    const finalScore = Math.max(0, Math.min(100, baseScore + 40));

    // Debug output
    console.log(`🔍 Simplified Risk Score Calculation:
    - Total Tokens: ${assetCount}
    - Scam Tokens: ${scamTokens.length}
    - Established Tokens: ${establishedTokens.length}
    - Verified Tokens: ${verifiedTokens.length}
    - Meaningful Tokens: ${meaningfulTokens}
    - Base Score Adjustments: ${baseScore}
    - Final Score: ${finalScore}/100 (base 40 + adjustments)
    - Key Factors: ${factors.slice(0, 3).join(', ')}`);

    return {
      score: finalScore,
      factors,
      details
    };
  }

  /**
   * Generate fallback analysis when GPT fails
   */
  private generateFallbackAssetAnalysis(data: any): AssetAnalysisResult {
    const { assetCount } = data;

    // Use the simplified quantity-based scoring system
    const scoringResult = this.calculateWeightedRiskScore(data);
    const { score: riskScore, factors, details } = scoringResult;

    // Generate recommendations based on the scoring factors
    const recommendations: string[] = [];

    // Scam token recommendations
    if (details.scamTokenCount > 0) {
      if (details.scamTokenCount > 20) {
        recommendations.push(`Consider cleaning up ${details.scamTokenCount} suspected scam tokens - many appear to be airdropped spam`);
      } else {
        recommendations.push(`Monitor ${details.scamTokenCount} suspected scam tokens for any unusual activity`);
      }
    }

    // Token diversity recommendations
    if (details.establishedTokens < 3) {
      recommendations.push('Consider adding more established tokens (ETH, USDC, BTC) for better stability');
    }

    if (details.totalTokens > 100) {
      recommendations.push('Consider consolidating token holdings to reduce management complexity');
    } else if (details.totalTokens < 5) {
      recommendations.push('Consider diversifying with additional quality tokens');
    }

    // Multi-chain recommendations
    const multiChain = data.multiChain;
    if (multiChain.totalChains === 1) {
      recommendations.push('Consider multi-chain diversification to reduce single-chain risk');
    }

    // Generate analysis summary
    let analysisText = `Simplified quantity-based analysis of wallet tokens. Portfolio contains ${assetCount} tokens across ${multiChain.totalChains} blockchain(s).`;
    
    if (details.establishedTokens > 0) {
      analysisText += ` Includes ${details.establishedTokens} established tokens providing stability.`;
    }

    if (details.scamTokenCount > 0) {
      analysisText += ` Detected ${details.scamTokenCount} suspected scam tokens, likely airdropped spam.`;
    }

    if (details.verifiedTokens > 0) {
      analysisText += ` Contains ${details.verifiedTokens} additional verified token contracts.`;
    }

    return {
      gpt_analysis: analysisText,
      risk_score: Math.round(riskScore),
      key_findings: factors,
      recommendations: recommendations
    };
  }
}

export default AssetAnalyzer;
