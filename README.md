# Risk Agent - AI-Powered Crypto Wallet Risk Analysis

A sophisticated Next.js application that provides comprehensive risk analysis for cryptocurrency wallets using AI and real-time web search capabilities.

## Features

- **AI-Powered Risk Analysis**: Uses GPT-4 to analyze wallet assets, DeFi positions, and overall portfolio risk
- **Real-Time Web Search**: Integrates with SerpAPI to search for token legitimacy, security issues, and market sentiment
- **Multi-Source Data**: Combines data from Zerion, Moralis, and web search for comprehensive analysis
- **Automated Risk Scoring**: Provides risk scores (0-100) with detailed explanations and recommendations
- **JSON Data Storage**: Persists analysis results for frontend consumption

## Environment Variables

Create a `.env.local` file in the root directory with the following API keys:

```env
# Required API Keys
ZERION_API_KEY=your_zerion_api_key_here
MORALIS_API_KEY=your_moralis_api_key_here
OPENAI_API_SECRET=your_openai_api_key_here
SERP_API_KEY=your_serpapi_key_here
```

### API Key Sources:
- **Zerion API**: Get from [Zerion API](https://developers.zerion.io/)
- **Moralis API**: Get from [Moralis](https://moralis.io/)
- **OpenAI API**: Get from [OpenAI Platform](https://platform.openai.com/)
- **SerpAPI**: Get from [SerpAPI](https://serpapi.com/) - Used for real-time web search

## Getting Started

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment variables** (see above)

3. **Run the development server:**
```bash
npm run dev
```

4. **Test wallet analysis:**
```bash
npx tsx scripts/test-analyzer.ts 0x_WALLET_ADDRESS_HERE
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Analysis Capabilities

### AI-Enhanced Asset Analysis
The system performs comprehensive analysis of wallet assets with GPT-4 enhanced by real-time web search:

- **Token Legitimacy Verification**: Searches for scam reports, security audits, and reputation data
- **Security Risk Assessment**: Identifies potential rugpulls, hacks, and suspicious contracts  
- **Market Sentiment Analysis**: Gathers recent news and community sentiment
- **Portfolio Concentration Analysis**: Evaluates diversification and risk distribution

### Web Search Integration
GPT-4 can dynamically search the web during analysis for:
- `TOKEN_NAME scam security audit` - Security verification
- `TOKEN_NAME recent news hack` - Recent incidents  
- `TOKEN_NAME market cap legitimacy` - Market validation
- Custom searches based on suspicious patterns detected

### Risk Scoring System
- **0-20**: Very Low Risk - Blue chip tokens, good diversification
- **21-40**: Low Risk - Established tokens, minor concerns
- **41-60**: Medium Risk - Mixed portfolio, some red flags
- **61-80**: High Risk - Concentration, unknown tokens, security issues
- **81-100**: Very High Risk - Likely scams, extreme risk factors

## Architecture

```
scripts/
├── api/
│   ├── serpAPI.ts        # Web search service
│   ├── zerionAPI.ts      # Portfolio data
│   └── moralisAPI.ts     # Blockchain data
├── analyseAssets.ts      # AI asset analysis with web search
├── analysePoolsGPT.ts    # DeFi pool analysis  
├── finalRiskAnalyzer.ts  # Comprehensive risk assessment
└── walletRiskAnalyzer.ts # Main orchestrator
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
