# Wallet Risk Analysis System

A comprehensive system for analyzing Ethereum wallet risk using real on-chain data from Moralis and AI-powered risk assessment.

## 🚀 Features

- **Asset Analysis**: Get complete token holdings including native ETH and ERC20 tokens
- **Transaction History**: Analyze recent transaction patterns and volume
- **DeFi Positions**: Track active positions across protocols
- **Protocol Interactions**: Identify which DeFi protocols the wallet has used
- **Risk Assessment**: AI-powered risk scoring based on on-chain activity
- **Modular Design**: Each function handles one specific task for easy maintenance

## 📋 Setup

### 1. Environment Variables

Create a `.env.local` file in your project root:

```bash
# Moralis Configuration (Required)
MORALIS_API_KEY=your_moralis_api_key_here

# OpenAI Configuration (Required for AI risk assessment)
OPENAI_API_KEY=your_openai_api_key_here
```

**Get your Moralis API key**: https://admin.moralis.io/

### 2. Install Dependencies

Dependencies are already installed via your `package.json`:
- `moralis`: ^2.27.2
- `@moralisweb3/next`: ^2.27.2

## 🔧 Usage

### API Endpoint

**POST** `/api/find-risk`
```json
{
  "address": "0x1234...abcd"
}
```

**GET** `/api/find-risk?address=0x1234...abcd`

### Response Format

```json
{
  "wallet": "0x1234...abcd",
  "risk_score": 25,
  "summary": "Low-risk established wallet with diversified holdings",
  "key_factors": ["Diversified portfolio", "Active DeFi usage"],
  "concerns": ["High transaction volume"],
  "confidence_level": "high",
  "final_notes": "Well-established wallet with good practices",
  "raw_analysis": {
    "address": "0x1234...abcd",
    "assets": [...],
    "transactions": [...],
    "defi_positions": [...],
    "protocols_interacted": [...],
    "total_portfolio_value": 15420.50,
    "transaction_count_30d": 45,
    "risk_indicators": {
      "interacted_with_mixers": false,
      "high_value_transactions": true,
      "new_wallet": false,
      "diverse_protocols": true
    }
  },
  "analysis_timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🧪 Testing

### Command Line Test

```bash
# Test with a specific wallet (Vitalik's wallet as example)
npx tsx src/scripts/test-wallet-analysis.ts 0xd8da6bf26964af9d7eed9e03e53415d37aa96045

# Test with your own wallet
npx tsx src/scripts/test-wallet-analysis.ts 0xYOUR_WALLET_ADDRESS
```

### API Test

```bash
# Using curl
curl -X POST http://localhost:3000/api/find-risk \
  -H "Content-Type: application/json" \
  -d '{"address": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"}'

# Using GET
curl "http://localhost:3000/api/find-risk?address=0xd8da6bf26964af9d7eed9e03e53415d37aa96045"
```

## 📚 Available Functions

### Core Analysis Functions

```typescript
import { 
  getComprehensiveWalletAnalysis,
  getWalletTokens,
  getNativeBalance,
  getWalletTransactions,
  getWalletDeFiPositions,
  getWalletProtocols,
  formatWalletAnalysisForRisk 
} from '@/lib/moralis-wallet-analyzer';
```

### Individual Functions

- **`getWalletTokens(address, chain?)`**: Get all ERC20 token balances
- **`getNativeBalance(address, chain?)`**: Get native ETH balance
- **`getWalletTransactions(address, chain?, limit?)`**: Get transaction history
- **`getWalletDeFiPositions(address, chain?)`**: Get active DeFi positions
- **`getWalletProtocols(address, chain?)`**: Get protocols interacted with
- **`getComprehensiveWalletAnalysis(address, chain?)`**: Get complete analysis
- **`formatWalletAnalysisForRisk(analysis)`**: Format for AI risk assessment

## 🏗️ Architecture

### Modular Design
Each function is designed to handle one specific task:

1. **Data Fetching**: Individual functions for each data type
2. **Data Processing**: Separate logic for risk analysis
3. **Data Formatting**: Dedicated formatting for AI consumption
4. **Error Handling**: Graceful handling of API errors
5. **Type Safety**: Full TypeScript support

### Risk Scoring Guidelines

- **0-20**: Very Low Risk (established wallets, diversified holdings)
- **21-40**: Low Risk (good activity history, minor concerns)
- **41-60**: Medium Risk (some concerns, limited history)
- **61-80**: High Risk (multiple red flags, suspicious activity)
- **81-100**: Very High Risk (severe red flags, mixer usage)

## 🔍 Risk Indicators

The system automatically checks for:

- **Mixer Interactions**: Tornado Cash and other privacy protocols
- **High Value Transactions**: Transactions > 10 ETH
- **New Wallet**: Created within last 30 days
- **Protocol Diversity**: Number of different DeFi protocols used

## 🚨 Error Handling

- Invalid address format validation
- Moralis API error recovery
- Missing environment variable checks
- Graceful degradation when data is unavailable

## 📊 Example Wallet Analysis

```typescript
const analysis = await getComprehensiveWalletAnalysis('0x...');
console.log({
  portfolioValue: analysis.total_portfolio_value,
  assetCount: analysis.assets.length,
  recentTxCount: analysis.transaction_count_30d,
  defiPositions: analysis.defi_positions.length,
  riskFlags: analysis.risk_indicators
});
```

## 🔧 Customization

### Adding New Risk Indicators

Edit `analyzeRiskIndicators()` in `moralis-wallet-analyzer.ts`:

```typescript
const custom_risk = transactions.some(tx => 
  // Your custom risk logic here
);

return {
  // existing indicators...
  custom_risk,
};
```

### Adding New Protocols

Update the `protocolMap` in `getWalletProtocols()`:

```typescript
const protocolMap: { [key: string]: string } = {
  // existing protocols...
  '0xYOUR_PROTOCOL_ADDRESS': 'Your Protocol Name',
};
```

## 📈 Next Steps

1. Test with various wallet addresses
2. Customize risk indicators for your use case
3. Add more protocol mappings
4. Integrate with your frontend application
5. Set up monitoring and alerting

## 🤝 Support

For issues with:
- **Moralis API**: Check [Moralis Documentation](https://docs.moralis.com/)
- **OpenAI API**: Check [OpenAI Documentation](https://platform.openai.com/docs)
- **Code Issues**: Review the TypeScript types and error messages