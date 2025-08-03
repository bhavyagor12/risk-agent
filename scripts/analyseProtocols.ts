import { OpenAI } from 'openai';
import DataManager from './data/dataManager';
import SerpAPI from './api/serpAPI';

export interface ProtocolAnalysisResult {
  gpt_analysis: string;
  risk_score: number;
  key_findings: string[];
  recommendations: string[];
}

class ProtocolAnalyzer {
  private dataManager: DataManager;
  private openai: OpenAI;
  private serpAPI: SerpAPI;

  // Knowledge base for protocol analysis
  private knowledgeBase = {
    // Contract address to protocol name mapping
    contractToProtocol: {
      // WETH (Wrapped Ethereum) - Tier 1
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { name: 'weth', tier: 1 },

      // Uniswap V2/V3 - Tier 1
      '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': { name: 'uniswap_v2_router', tier: 1 },
      '0xe592427a0aece92de3edee1f18e0157c05861564': { name: 'uniswap_v3_router', tier: 1 },
      '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': { name: 'uniswap_v3_router_2', tier: 1 },

      // 1inch - Tier 2
      '0x1111111254eeb25477b68fb85ed929f73a960582': { name: '1inch_v4', tier: 2 },
      '0x1111111254fb6c44bac0bed2854e76f90643097d': { name: '1inch_v5', tier: 2 },

      // OpenSea - Tier 2
      '0x00000000006c3852cbef3e08e8df289169ede581': { name: 'opensea_seaport', tier: 2 },
      '0x00000000000001ad428e4906ae43d8f9852d0dd6': { name: 'opensea_seaport_1_4', tier: 2 },

      // Common token contracts - Tier 1
      '0xa0b86991c31cc0c4c4c4526c1e7e56b2e5c1b7b3ca7': { name: 'usdc', tier: 1 },
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { name: 'usdc_proxy', tier: 1 },
      '0xdac17f958d2ee523a2206206994597c13d831ec7': { name: 'usdt', tier: 1 },
      '0x6b175474e89094c44da98b954eedeac495271d0f': { name: 'dai', tier: 1 },

      // Common DeFi protocols
      '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9': { name: 'aave_v2_lending_pool', tier: 1 },
      '0x87870bace4823e47d8fc3b2b0c34029e6ceaebf6': { name: 'aave_v3_pool', tier: 1 },

      // Curve Finance - Tier 1
      '0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2': { name: 'curve_voting_escrow', tier: 1 },
      '0xd533a949740bb3306d119cc777fa900ba034cd52': { name: 'crv_token', tier: 1 },

      // Lido - Tier 1
      '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': { name: 'steth', tier: 1 },
      '0x5a98fcbea516cf06857215779fd812ca3bef1b32': { name: 'lido_dao', tier: 1 },

      // Balancer - Tier 1
      '0xba12222222228d8ba445958a75a0704d566bf2c8': { name: 'balancer_v2_vault', tier: 1 },

      // SushiSwap - Tier 2
      '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f': { name: 'sushiswap_router', tier: 2 },

      // Yearn - Tier 2
      '0x19d3364a399d251e894ac732651be8b0e4e85001': { name: 'yearn_v2_yusdc_vault', tier: 2 },
      '0x5dbcF33D8c2E976c6b560249878e6F1491Bca25c': { name: 'yearn_v2_ydai_vault', tier: 2 },

      // Compound - Tier 1
      '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b': { name: 'compound_comptroller', tier: 1 },
      '0xc00e94cb662c3520282e6f5717214004a7f26888': { name: 'comp_token', tier: 1 },

      // MakerDAO - Tier 1
      '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2': { name: 'mkr_token', tier: 1 },
      '0x5ef30b9986345249bc32d8928b7ee64de9435e39': { name: 'maker_cdps', tier: 1 },

      // Arbitrum Bridge - Tier 1
      '0xC1f981BfF38a184c6FcC5d5eA3e7Ab62F36c1Ce3': { name: 'arbitrum_l1_gateway_router', tier: 1 },

      // Optimism Bridge - Tier 1
      '0x636Af16bf2f682dD3109e60102b8E1A089FedAa8': { name: 'optimism_l1_standard_bridge', tier: 1 },

      // ENS Registry - Tier 1
      '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e': { name: 'ens_registry', tier: 1 },

      // Stargate (LayerZero) - Tier 2
      '0x8731d54E9D02c286767d56ac03e8037C07e01e98': { name: 'stargate_router', tier: 2 },

      // Hop Protocol - Tier 2
      '0x3E4a3a4796d16c0Cd582C382691998f7c06420B6': { name: 'hop_bridge', tier: 2 },

      // Metamask Swap Router - Tier 3
      '0x881D40237659C251811CEC9c364ef91dC08D300C': { name: 'metamask_swap_router', tier: 3 },

      '0xd01607c3c5ecaba394d8be377a08590149325722': {name:'Aave V3 ETH Staking contract', tier: 1},

      '0x4d5f47fa6a74757f35c14fd3a6ef8e3c9bc514e8':{name:'Aave Ethereum WETH token', tier: 1},

      '0x4da27a545c0c5b758a6ba100e3a049001de870f5': {name:'stkAAVE', tier: 1},

      '0xd01607c3C5eCABa394D8be377a08590149325722':{name:"AAVE Eth Staking contract", tier: 1}
    
    } as { [key: string]: { name: string; tier: number } },

    trustedProtocols: {
      tier1: ['aave', 'compound', 'makerdao', 'uniswap', 'curve', 'lido', 'ethereum', 'weth', 'usdc', 'usdc_proxy', 'usdt', 'dai'],
      tier2: ['sushiswap', 'balancer', 'convex', 'yearn', 'synthetix', '1inch', 'opensea'],
      tier3: ['pancakeswap', 'quickswap', 'spookyswap', 'traderjoe', 'frax', 'bancor']
    },
    riskIndicators: {
      high: ['unknown protocol', 'unaudited', 'new protocol', 'experimental', 'high governance risk'],
      medium: ['moderate adoption', 'recent audit', 'governance changes', 'oracle dependency'],
      low: ['established protocol', 'battle-tested', 'multiple audits', 'strong governance']
    },
    interactionTypes: {
      safe: ['token transfer', 'erc20 approve', 'native transfer'],
      moderate: ['dex swap', 'lending', 'staking', 'nft trade'],
      risky: ['flash loan', 'complex defi', 'bridge', 'governance proposal']
    }
  };

  constructor(
    openaiApiKey: string,
    serpApiKey: string,
    dataManager: DataManager
  ) {
    this.dataManager = dataManager;
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.serpAPI = new SerpAPI(serpApiKey);
  }

  /**
   * Analyze protocol interactions for a wallet
   */
  async analyzeWalletProtocols(address: string, existingWalletData?: any): Promise<ProtocolAnalysisResult> {
    try {
      console.log(`🏗️ Analyzing protocol interactions for wallet: ${address}`);

      // Extract protocol data from existing wallet data
      const protocolData = this.extractProtocolData(existingWalletData);

      // If no protocol interactions found
      if (protocolData.protocolInteractions.length === 0) {
        const noProtocolsResult = {
          gpt_analysis: 'No significant protocol interactions detected. The wallet appears to primarily use basic Ethereum functionality (token transfers, native transactions) without extensive DeFi or protocol engagement.',
          risk_score: 5,
          key_findings: ['Minimal protocol exposure', 'Basic transaction patterns', 'Low smart contract risk', 'Conservative usage patterns'],
          recommendations: [
            'Current approach minimizes protocol risks',
            'Consider exploring established DeFi protocols for yield opportunities',
            'If expanding to DeFi, start with tier-1 protocols like Aave or Uniswap',
            'Maintain current conservative approach if risk tolerance is low'
          ]
        };

        await this.dataManager.updateAnalysis(address, 'protocols', noProtocolsResult);
        return noProtocolsResult;
      }

      // Enhance protocol data with web search for unknown protocols
      const enhancedProtocolData = await this.enhanceProtocolDataWithSearch(protocolData);

      // Generate GPT analysis with enhanced data
      const gptAnalysis = await this.generateGPTProtocolAnalysis(enhancedProtocolData);

      // Store analysis results
      await this.dataManager.updateAnalysis(address, 'protocols', gptAnalysis);

      return gptAnalysis;

    } catch (error: any) {
      console.error('Protocol analysis error:', error.message);
      throw new Error(`Failed to analyze protocols: ${error.message}`);
    }
  }

  /**
   * Extract protocol interaction data from wallet data
   */
  private extractProtocolData(walletData: any) {
    const protocolInteractions = [];
    const protocolCounts: { [key: string]: number } = {};
    const protocolVolumes: { [key: string]: number } = {};
    const riskTransactions = [];
    let totalInteractions = 0;
    let totalVolume = 0;

    // Extract from transaction data - handle flexible data structure
    const transactions = walletData?.raw_data?.moralis?.raw_ethereum_transactions?.result ||
      walletData?.raw_data?.moralis?.raw_ethereum_transactions ||
      walletData?.raw_data?.moralis?.ethereum?.transactions || [];

    for (const tx of transactions.slice(0, 50)) { // Analyze recent 50 transactions
      if (tx.to_address && tx.to_address !== tx.from_address) {
        const interaction = this.categorizeTransaction(tx);
        if (interaction) {
          // Add transaction value context (convert wei to ETH and estimate USD)
          const valueInWei = parseFloat(tx.value || '0');
          const valueInEth = valueInWei / 1e18;
          // Rough ETH price estimate - in a real system, you'd get current price
          const ethPriceUsd = 2500; // Approximate ETH price
          const txValue = valueInEth * ethPriceUsd;

          const enhancedInteraction = {
            ...interaction,
            value_usd: txValue,
            is_failed: tx.receipt_status === '0'
          };

          protocolInteractions.push(enhancedInteraction);
          protocolCounts[enhancedInteraction.protocol] = (protocolCounts[enhancedInteraction.protocol] || 0) + 1;
          protocolVolumes[enhancedInteraction.protocol] = (protocolVolumes[enhancedInteraction.protocol] || 0) + txValue;
          totalInteractions++;
          totalVolume += txValue;

          // Flag high-risk transactions (large amounts with unknown protocols)
          if (this.isHighRiskTransaction(enhancedInteraction, txValue)) {
            riskTransactions.push({
              ...enhancedInteraction,
              tx_hash: tx.transaction_hash,
              timestamp: tx.block_timestamp
            });
          }
        }
      }
    }

    // Extract from DeFi positions (protocols used) - handle flexible data structure
    const chains = ['ethereum', 'base', 'polygon'];
    const defiProtocols = new Set<string>();

    for (const chain of chains) {
      // Try raw API data first, then fallback to processed data
      const rawDefiPositions = walletData?.raw_data?.moralis?.[`raw_${chain}_defi_positions`]?.result ||
        walletData?.raw_data?.moralis?.[`raw_${chain}_defi_positions`] ||
        walletData?.raw_data?.moralis?.[chain]?.defi_positions || [];

      const rawPortfolioDefi = walletData?.raw_data?.moralis?.[`raw_${chain}_portfolio`]?.defiPositions ||
        walletData?.raw_data?.moralis?.[`raw_${chain}_portfolio`]?.rawResponses?.defiPositions ||
        walletData?.raw_data?.moralis?.[chain]?.portfolio?.defiPositions || [];

      // Process raw DeFi positions
      for (const position of rawDefiPositions) {
        if (position.protocol_name) {
          defiProtocols.add(position.protocol_name.toLowerCase());
        }
      }

      // Process portfolio DeFi positions
      for (const position of rawPortfolioDefi) {
        if (position.protocol_name) {
          defiProtocols.add(position.protocol_name.toLowerCase());
        }
      }
    }

    // Add DeFi protocols to interactions
    defiProtocols.forEach(protocol => {
      protocolInteractions.push({
        type: 'defi_position',
        protocol: protocol,
        riskLevel: this.assessProtocolRisk(protocol),
        chain: 'multi-chain'
      });
      protocolCounts[protocol] = (protocolCounts[protocol] || 0) + 1;
    });

    console.log({
      protocolInteractions,
      protocolCounts,
      protocolVolumes,
      riskTransactions,
      totalInteractions,
      totalVolume,
      uniqueProtocols: Object.keys(protocolCounts).length,
      chains: walletData?.raw_data?.moralis?.combined_metrics?.chains_with_activity || []
    })

    return {
      protocolInteractions,
      protocolCounts,
      protocolVolumes,
      riskTransactions,
      totalInteractions,
      totalVolume,
      uniqueProtocols: Object.keys(protocolCounts).length,
      chains: walletData?.raw_data?.moralis?.combined_metrics?.chains_with_activity || []
    };
  }

  /**
   * Determine if a transaction represents high risk
   */
  private isHighRiskTransaction(interaction: any, valueUsd: number): boolean {
    // Risk thresholds
    const HIGH_VALUE_THRESHOLD = 10000; // $10k+
    const MEDIUM_VALUE_THRESHOLD = 1000; // $1k+

    // High risk conditions:
    // 1. Large value with unknown protocol
    if (valueUsd > HIGH_VALUE_THRESHOLD && interaction.riskLevel === 'high') {
      return true;
    }

    // 2. Medium value with unknown protocol AND failed transaction
    if (valueUsd > MEDIUM_VALUE_THRESHOLD && interaction.riskLevel === 'high' && interaction.is_failed) {
      return true;
    }

    // 3. Any failed transaction over $1k regardless of protocol
    if (valueUsd > MEDIUM_VALUE_THRESHOLD && interaction.is_failed) {
      return true;
    }

    return false;
  }

  /**
   * Categorize a transaction by protocol interaction
   */
  private categorizeTransaction(tx: any) {
    if (!tx.to_address) return null;

    const toAddress = tx.to_address.toLowerCase();

    // First, try to match against known contract addresses
    const knownContract = this.knowledgeBase.contractToProtocol[toAddress];
    if (knownContract) {
      const riskLevel = knownContract.tier === 1 ? 'low' : knownContract.tier === 2 ? 'low' : 'medium';
      return {
        type: this.getInteractionType(knownContract.name),
        protocol: knownContract.name,
        riskLevel: riskLevel,
        chain: 'ethereum'
      };
    }

    // Legacy pattern matching for protocols not in the mapping
    if (toAddress.includes('uniswap') || tx.input?.includes('0x38ed1739')) {
      return { type: 'dex_swap', protocol: 'uniswap', riskLevel: 'low', chain: 'ethereum' };
    }

    if (toAddress.includes('aave') || tx.input?.includes('0x573ade81')) {
      return { type: 'lending', protocol: 'aave', riskLevel: 'low', chain: 'ethereum' };
    }

    // For unknown contracts, use full address instead of truncating
    if (tx.input && tx.input.length > 10) {
      return {
        type: 'smart_contract',
        protocol: toAddress, // Use full address instead of truncating
        riskLevel: 'medium',
        chain: 'ethereum'
      };
    }

    return null;
  }

  /**
   * Determine interaction type based on protocol name
   */
  private getInteractionType(protocolName: string): string {
    if (protocolName.includes('uniswap') || protocolName.includes('1inch')) {
      return 'dex_swap';
    }
    if (protocolName.includes('aave') || protocolName.includes('compound')) {
      return 'lending';
    }
    if (protocolName.includes('opensea')) {
      return 'nft_trade';
    }
    if (protocolName.includes('weth') || protocolName.includes('usdc') || protocolName.includes('usdt') || protocolName.includes('dai')) {
      return 'token_interaction';
    }
    return 'smart_contract';
  }

  /**
   * Assess risk level of a protocol
   */
  private assessProtocolRisk(protocol: string): 'low' | 'medium' | 'high' {
    const protocolLower = protocol.toLowerCase();

    // First check if it's a known contract address
    const knownContract = this.knowledgeBase.contractToProtocol[protocolLower];
    if (knownContract) {
      return knownContract.tier === 1 ? 'low' : knownContract.tier === 2 ? 'low' : 'medium';
    }

    // Then check by protocol name patterns
    if (this.knowledgeBase.trustedProtocols.tier1.some(p => protocolLower.includes(p))) {
      return 'low';
    }

    if (this.knowledgeBase.trustedProtocols.tier2.some(p => protocolLower.includes(p))) {
      return 'low';
    }

    if (this.knowledgeBase.trustedProtocols.tier3.some(p => protocolLower.includes(p))) {
      return 'medium';
    }

    return 'high'; // Unknown protocol
  }

  /**
   * Search for protocol information using web search
   */
  private async searchProtocolInfo(protocolName: string): Promise<string> {
    try {
      console.log(`🌐 Searching for protocol info: ${protocolName}`);

      const queries = [
        `${protocolName} DeFi protocol security audit`,
        `${protocolName} cryptocurrency protocol risks`,
        `${protocolName} protocol TVL reputation`
      ];

      const searchPromises = queries.map(query =>
        this.serpAPI.search(query, { num: 4 })
      );

      const results = await Promise.all(searchPromises);

      let formattedResults = `WEB SEARCH RESULTS FOR ${protocolName.toUpperCase()}:\n\n`;

      results.forEach((result, index) => {
        formattedResults += `SEARCH ${index + 1}: ${queries[index]}\n`;
        formattedResults += this.serpAPI.formatSearchResults(result);
        formattedResults += '\n';
      });

      return formattedResults;

    } catch (error: any) {
      console.error(`Protocol search error for ${protocolName}:`, error.message);
      return `Unable to retrieve web information for ${protocolName}: ${error.message}`;
    }
  }

  /**
   * Enhanced protocol risk assessment with web search
   */
  private async assessProtocolRiskWithSearch(protocol: string): Promise<{
    riskLevel: 'low' | 'medium' | 'high';
    webInfo: string;
    reasoning: string;
  }> {
    try {
      // Get base risk level from static knowledge
      const baseRisk = this.assessProtocolRisk(protocol);

      // Only search for unknown protocols to avoid API overuse
      if (baseRisk === 'high') {
        const webInfo = await this.searchProtocolInfo(protocol);
        return {
          riskLevel: baseRisk,
          webInfo,
          reasoning: `Unknown protocol - requires web research. ${webInfo.includes('audit') ? 'Some audit information found.' : 'Limited audit information available.'}`
        };
      }

      return {
        riskLevel: baseRisk,
        webInfo: '',
        reasoning: `Known ${baseRisk} risk protocol from established knowledge base`
      };

    } catch (error: any) {
      console.error(`Risk assessment error for ${protocol}:`, error.message);
      return {
        riskLevel: 'high',
        webInfo: '',
        reasoning: `Error assessing protocol risk: ${error.message}`
      };
    }
  }

  /**
   * Enhance protocol data with web search information
   */
  private async enhanceProtocolDataWithSearch(protocolData: any): Promise<any> {
    try {
      console.log(`🔍 Enhancing protocol data with web search...`);

      const { protocolCounts } = protocolData;
      const unknownProtocols = Object.keys(protocolCounts).filter(protocol =>
        this.assessProtocolRisk(protocol) === 'high'
      );

      // Limit searches to avoid API overuse (max 3 unknown protocols)
      const protocolsToSearch = unknownProtocols.slice(0, 3);
      const searchResults: { [protocol: string]: any } = {};

      if (protocolsToSearch.length > 0) {
        console.log(`🌐 Researching ${protocolsToSearch.length} unknown protocols: ${protocolsToSearch.join(', ')}`);

        for (const protocol of protocolsToSearch) {
          const searchResult = await this.assessProtocolRiskWithSearch(protocol);
          searchResults[protocol] = searchResult;

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      return {
        ...protocolData,
        webSearchResults: searchResults,
        enhancedProtocols: protocolsToSearch
      };

    } catch (error: any) {
      console.error('Protocol enhancement error:', error.message);
      return {
        ...protocolData,
        webSearchResults: {},
        enhancedProtocols: []
      };
    }
  }

  /**
   * Generate GPT-powered protocol analysis
   */
  private async generateGPTProtocolAnalysis(protocolData: any): Promise<ProtocolAnalysisResult> {
    try {
      const prompt = this.buildProtocolAnalysisPrompt(protocolData);

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `<role>
You are a blockchain security analyst specializing in DeFi protocol usage analysis. Your job is to identify ACTUAL security risks, not penalize normal DeFi activity. Protocol interaction and diversification are positive indicators of sophisticated crypto usage.
</role>

<analysis_philosophy>
- Protocol interaction is POSITIVE and shows active DeFi engagement
- Focus on TRANSACTION VALUE and OUTCOMES, not just protocol names
- Diversified protocol usage demonstrates sophistication, not risk
- Only flag genuine red flags: high-value failed transactions, suspicious patterns, actual losses
- Small transactions with unknown protocols are normal DeFi exploration
- Large transactions (>$1000) with unvetted protocols warrant scrutiny
</analysis_philosophy>

<knowledge_base>
<trusted_protocols>
<tier1 risk="very_low">aave, compound, makerdao, uniswap, curve, lido, ethereum</tier1>
<tier2 risk="low">sushiswap, balancer, convex, yearn, synthetix, 1inch, opensea</tier2>
<tier3 risk="moderate">pancakeswap, quickswap, spookyswap, traderjoe, frax, bancor</tier3>
</trusted_protocols>

<actual_risk_indicators>
<high_risk>Large failed transactions (>$1000), High-value transactions with unaudited protocols (>$10000), Pattern of consistent losses, Obvious rug pulls or exploits</high_risk>
<medium_risk>Failed transactions $100-$1000, Medium-value unknown protocols ($1000-$10000), Frequent failed transactions</medium_risk>
<low_risk>Small unknown protocol interactions (<$100), Successful transactions with unknown protocols, Normal DeFi diversification</low_risk>
</actual_risk_indicators>

<web_research_guidance>
When web search results are provided for unknown protocols, prioritize this live data over static assumptions. Look for:
- Security audit information and findings
- Community reputation and TVL data
- Recent security incidents or exploits
- Official protocol documentation and team information
- Red flags like anonymous teams, unaudited code, or suspicious patterns

Adjust risk scores based on web research findings. If web search reveals positive audit results and strong reputation, consider lowering the risk. If concerning findings are discovered, maintain or increase the risk assessment.
</web_research_guidance>
</knowledge_base>

<risk_scoring>
<level range="0-20" category="very_low">Successful DeFi usage, no significant failed transactions, good diversification</level>
<level range="21-40" category="low">Mostly successful usage, minor failed transactions, healthy protocol mix</level>
<level range="41-60" category="medium">Some concerning failed transactions or medium-value unknown protocol usage</level>
<level range="61-80" category="high">High-value failed transactions or concerning loss patterns</level>
<level range="81-100" category="very_high">Clear evidence of major losses, rug pulls, or dangerous protocol usage</level>
</risk_scoring>

<output_format>
CRITICAL: You must respond with valid JSON only. Do not include any text before or after the JSON.
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
      console.error('GPT protocol analysis error:', error.message);
      return this.generateFallbackProtocolAnalysis(protocolData);
    }
  }

  /**
   * Build prompt for GPT protocol analysis
   */
  private buildProtocolAnalysisPrompt(data: any): string {
    const { protocolInteractions, protocolCounts, protocolVolumes, riskTransactions, totalInteractions, totalVolume, uniqueProtocols, chains, webSearchResults, enhancedProtocols } = data;

    let prompt = `WALLET PROTOCOL USAGE ANALYSIS REQUEST

OVERVIEW:
- Total Protocol Interactions: ${totalInteractions}
- Total Transaction Volume: $${(totalVolume || 0).toFixed(2)}
- Unique Protocols Used: ${uniqueProtocols}
- High-Risk Transactions Detected: ${riskTransactions?.length || 0}
- Active Chains: ${chains.join(', ').toUpperCase()}

PROTOCOL USAGE BREAKDOWN (with volume):`;

    for (const [protocol, count] of Object.entries(protocolCounts)) {
      const volume = protocolVolumes?.[protocol] || 0;
      prompt += `\n- ${protocol}: ${count} interaction(s), $${volume.toFixed(2)} volume`;
    }

    prompt += `\n\nDETAILED INTERACTIONS:`;

    const interactionsByType = protocolInteractions.reduce((acc: any, interaction: any) => {
      const key = `${interaction.type}-${interaction.riskLevel}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(interaction);
      return acc;
    }, {});

    for (const [key, interactions] of Object.entries(interactionsByType)) {
      const interactionList = interactions as any[];
      prompt += `\n- ${key}: ${interactionList.length} interactions`;

      const protocols = [...new Set(interactionList.map(i => i.protocol))];
      if (protocols.length <= 3) {
        prompt += ` (${protocols.join(', ')})`;
      } else {
        prompt += ` (${protocols.slice(0, 3).join(', ')}, +${protocols.length - 3} more)`;
      }
    }

    // Risk assessment by protocol tiers
    const tier1Protocols = Object.keys(protocolCounts).filter(p =>
      this.knowledgeBase.trustedProtocols.tier1.some(tp => p.toLowerCase().includes(tp))
    );
    const tier2Protocols = Object.keys(protocolCounts).filter(p =>
      this.knowledgeBase.trustedProtocols.tier2.some(tp => p.toLowerCase().includes(tp))
    );
    const unknownProtocols = Object.keys(protocolCounts).filter(p =>
      !tier1Protocols.includes(p) && !tier2Protocols.includes(p)
    );

    if (tier1Protocols.length > 0) {
      prompt += `\n\nTIER 1 PROTOCOLS (Trusted): ${tier1Protocols.join(', ')}`;
    }
    if (tier2Protocols.length > 0) {
      prompt += `\nTIER 2 PROTOCOLS (Established): ${tier2Protocols.join(', ')}`;
    }
    if (unknownProtocols.length > 0) {
      prompt += `\nUNKNOWN/UNVETTED PROTOCOLS: ${unknownProtocols.join(', ')}`;
    }

    // Add web search results for unknown protocols
    if (webSearchResults && Object.keys(webSearchResults).length > 0) {
      prompt += `\n\nWEB RESEARCH RESULTS FOR UNKNOWN PROTOCOLS:`;
      prompt += `\nProtocols researched: ${enhancedProtocols?.join(', ') || 'None'}`;

      for (const [protocol, searchData] of Object.entries(webSearchResults)) {
        const data = searchData as { riskLevel: string; reasoning: string; webInfo: string };
        prompt += `\n\n--- ${protocol.toUpperCase()} RESEARCH ---`;
        prompt += `\nRisk Assessment: ${data.riskLevel}`;
        prompt += `\nReasoning: ${data.reasoning}`;
        if (data.webInfo) {
          prompt += `\nWeb Search Results:\n${data.webInfo}`;
        }
      }

      prompt += `\n\nNOTE: Use the above web research to inform your analysis of unknown protocols. Consider the actual search results when assessing risks.`;
    }

    // Add high-risk transaction details
    if (riskTransactions && riskTransactions.length > 0) {
      prompt += `\n\nHIGH-RISK TRANSACTIONS DETECTED:`;
      for (const riskTx of riskTransactions) {
        prompt += `\n- ${riskTx.protocol}: $${riskTx.value_usd.toFixed(2)} ${riskTx.is_failed ? '(FAILED)' : '(SUCCESS)'} - ${riskTx.type}`;
      }
    }

    prompt += `\n\nIMPORTANT ANALYSIS GUIDELINES:
- Protocol interaction is NOT inherently risky - it shows active DeFi engagement
- Focus on ACTUAL risk indicators: high-value transactions with unknown protocols, failed transactions, suspicious patterns
- Consider transaction amounts - $10 with unknown protocol is different from $10,000
- Diversified protocol usage should be viewed POSITIVELY, not negatively
- Only flag genuine risk patterns, not normal DeFi activity

Please analyze this wallet's protocol usage focusing on:
1. ACTUAL RISK ASSESSMENT: Are there high-value transactions with risky protocols?
2. Failed transaction analysis: Any patterns of losses or failed interactions?
3. Transaction size context: Large transactions deserve more scrutiny than small ones
4. Protocol diversification: Is this healthy DeFi engagement or concerning behavior?
5. Unknown protocol assessment: Focus on those with significant volume or failed transactions
6. Overall security posture: Real vulnerabilities vs normal DeFi participation

Provide risk assessment based on ACTUAL risk indicators, not just protocol interaction count. Reward sophisticated DeFi usage when appropriate.`;

    return prompt;
  }

  /**
   * Generate fallback analysis when GPT fails
   */
  private generateFallbackProtocolAnalysis(data: any): ProtocolAnalysisResult {
    const { protocolCounts, protocolVolumes, riskTransactions, totalVolume, uniqueProtocols } = data;

    let riskScore = 15; // Base low score - protocol usage is good
    const keyFindings: string[] = [];
    const recommendations: string[] = [];

    // Focus on actual risk indicators
    const highRiskTxCount = riskTransactions?.length || 0;
    const averageTransactionValue = totalVolume / Object.keys(protocolCounts).length || 0;

    // Assess based on actual risk factors
    if (highRiskTxCount > 0) {
      riskScore += Math.min(highRiskTxCount * 15, 60); // Cap at 60 for risk transactions
      keyFindings.push(`${highRiskTxCount} high-risk transaction(s) detected`);
      recommendations.push('Review high-value failed transactions or interactions with unvetted protocols');
    } else {
      keyFindings.push('No high-risk transactions detected');
      riskScore -= 5; // Reward for no risky transactions
    }

    // Reward protocol diversification
    if (uniqueProtocols > 5) {
      keyFindings.push(`Good protocol diversification with ${uniqueProtocols} unique protocols`);
      riskScore -= 5; // Reward diversification
      recommendations.push('Continue diversified DeFi usage for risk distribution');
    }

    // Assess transaction volume context  
    if (averageTransactionValue > 1000) {
      keyFindings.push(`Higher average transaction values ($${averageTransactionValue.toFixed(2)}) require careful protocol selection`);
      recommendations.push('For high-value transactions, prioritize well-audited protocols');
    } else if (averageTransactionValue < 100) {
      keyFindings.push('Low-value transactions indicate normal DeFi exploration');
      riskScore -= 3; // Reward for small experimental amounts
    }

    // Assessment of overall approach
    if (riskScore <= 20) {
      keyFindings.push('Protocol usage patterns show good risk management');
    } else if (riskScore <= 40) {
      keyFindings.push('Moderate risk profile with room for improvement');
    }

    riskScore = Math.max(0, Math.min(100, riskScore));

    return {
      gpt_analysis: `Protocol usage analysis shows engagement with ${uniqueProtocols} unique protocols across $${totalVolume.toFixed(2)} in transaction volume. This demonstrates ${uniqueProtocols > 3 ? 'sophisticated' : 'basic'} DeFi participation. ${keyFindings.join('. ')}.`,
      risk_score: riskScore,
      key_findings: keyFindings,
      recommendations: recommendations
    };
  }
}

export default ProtocolAnalyzer;