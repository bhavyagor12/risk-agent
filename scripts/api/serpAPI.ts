import fetch from 'node-fetch';

export interface SerpSearchResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
}

export interface SerpResponse {
  query: string;
  results: SerpSearchResult[];
  searchParameters: {
    engine: string;
    q: string;
    type: string;
  };
}

/**
 * SerpAPI service for web search functionality
 * Provides search capabilities for cryptocurrency and security research
 */
export default class SerpAPI {
  private apiKey: string;
  private baseUrl: string = 'https://serpapi.com/search';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('SerpAPI key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Perform a web search using SerpAPI
   */
  async search(query: string, options: {
    num?: number;
    hl?: string;
    gl?: string;
  } = {}): Promise<SerpResponse> {
    try {
      const params = new URLSearchParams({
        engine: 'google',
        q: query,
        api_key: this.apiKey,
        num: (options.num || 10).toString(),
        hl: options.hl || 'en',
        gl: options.gl || 'us'
      });

      console.log(`🌐 Searching: "${query}"`);
      
      const response = await fetch(`${this.baseUrl}?${params}`);
      
      if (!response.ok) {
        throw new Error(`SerpAPI error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;

      // Parse the response into our standardized format
      const results: SerpSearchResult[] = (data.organic_results || []).map((result: any) => ({
        title: result.title || '',
        link: result.link || '',
        snippet: result.snippet || '',
        date: result.date
      }));

      return {
        query,
        results,
        searchParameters: {
          engine: 'google',
          q: query,
          type: 'organic'
        }
      };

    } catch (error: any) {
      console.error('SerpAPI search error:', error.message);
      throw new Error(`Failed to search: ${error.message}`);
    }
  }

  /**
   * Search specifically for cryptocurrency token information
   */
  async searchToken(tokenSymbol: string, additionalTerms: string = ''): Promise<SerpResponse> {
    const query = `${tokenSymbol} cryptocurrency token ${additionalTerms}`.trim();
    return this.search(query, { num: 8 });
  }

  /**
   * Search for security and scam information about a token
   */
  async searchTokenSecurity(tokenSymbol: string): Promise<SerpResponse> {
    const query = `${tokenSymbol} cryptocurrency scam security audit hack rugpull`;
    return this.search(query, { num: 6 });
  }

  /**
   * Search for recent news about a token
   */
  async searchTokenNews(tokenSymbol: string): Promise<SerpResponse> {
    const query = `${tokenSymbol} cryptocurrency news recent updates`;
    return this.search(query, { num: 5 });
  }

  /**
   * Search for market data and legitimacy information
   */
  async searchTokenMarket(tokenSymbol: string): Promise<SerpResponse> {
    const query = `${tokenSymbol} cryptocurrency market cap price coinmarketcap coingecko`;
    return this.search(query, { num: 5 });
  }

  /**
   * Format search results into a readable summary for GPT
   */
  formatSearchResults(searchResponse: SerpResponse): string {
    const { query, results } = searchResponse;
    
    if (results.length === 0) {
      return `No search results found for: "${query}"`;
    }

    let formatted = `Search results for: "${query}"\n\n`;
    
    results.slice(0, 6).forEach((result, index) => {
      formatted += `${index + 1}. ${result.title}\n`;
      formatted += `   ${result.snippet}\n`;
      formatted += `   Source: ${result.link}\n`;
      if (result.date) {
        formatted += `   Date: ${result.date}\n`;
      }
      formatted += '\n';
    });

    return formatted;
  }

  /**
   * Comprehensive token research combining multiple search types
   */
  async comprehensiveTokenSearch(tokenSymbol: string): Promise<{
    general: SerpResponse;
    security: SerpResponse;
    news: SerpResponse;
    market: SerpResponse;
    summary: string;
  }> {
    try {
      console.log(`🔍 Performing comprehensive search for token: ${tokenSymbol}`);
      
      const [general, security, news, market] = await Promise.all([
        this.searchToken(tokenSymbol),
        this.searchTokenSecurity(tokenSymbol),
        this.searchTokenNews(tokenSymbol),
        this.searchTokenMarket(tokenSymbol)
      ]);

      // Create a comprehensive summary
      let summary = `COMPREHENSIVE SEARCH RESULTS FOR ${tokenSymbol.toUpperCase()}\n`;
      summary += '='.repeat(60) + '\n\n';
      
      summary += '🔍 GENERAL INFORMATION:\n';
      summary += this.formatSearchResults(general) + '\n';
      
      summary += '🛡️ SECURITY & RISKS:\n';
      summary += this.formatSearchResults(security) + '\n';
      
      summary += '📰 RECENT NEWS:\n';
      summary += this.formatSearchResults(news) + '\n';
      
      summary += '📊 MARKET DATA:\n';
      summary += this.formatSearchResults(market) + '\n';

      return {
        general,
        security,
        news,
        market,
        summary
      };

    } catch (error: any) {
      console.error(`Comprehensive search error for ${tokenSymbol}:`, error.message);
      throw error;
    }
  }
}