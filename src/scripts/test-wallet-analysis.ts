#!/usr/bin/env npx tsx

/**
 * Test script for wallet analysis functions
 * Usage: npx tsx src/scripts/test-wallet-analysis.ts [wallet_address]
 */

import { 
  initializeMoralis, 
  getComprehensiveWalletAnalysis, 
  formatWalletAnalysisForRisk,
  getWalletTokens,
  getNativeBalance,
  getWalletTransactions,
  getWalletDeFiPositions,
  getWalletProtocols
} from '../lib/moralis-wallet-analyzer';

async function testWalletAnalysis() {
  const walletAddress = process.argv[2] || '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'; // Vitalik's wallet as default
  
  console.log('🚀 Testing wallet analysis functions...');
  console.log(`📍 Analyzing wallet: ${walletAddress}\n`);

  // Check for API key
  const apiKey = process.env.MORALIS_API_KEY;
  if (!apiKey) {
    console.error('❌ MORALIS_API_KEY environment variable is required');
    console.log('Please add MORALIS_API_KEY to your .env.local file');
    console.log('Get your API key from: https://admin.moralis.io/');
    process.exit(1);
  }

  try {
    // Initialize Moralis
    console.log('🔧 Initializing Moralis...');
    await initializeMoralis(apiKey);
    console.log('✅ Moralis initialized\n');

    // Test individual functions
    console.log('1️⃣ Testing native balance...');
    const nativeBalance = await getNativeBalance(walletAddress);
    console.log(`   ETH Balance: ${(parseFloat(nativeBalance.balance) / 1e18).toFixed(4)} ETH`);
    console.log(`   USD Value: $${nativeBalance.usd_value?.toFixed(2) || 'N/A'}\n`);

    console.log('2️⃣ Testing token balances...');
    const tokens = await getWalletTokens(walletAddress);
    console.log(`   Found ${tokens.length} tokens`);
    tokens.slice(0, 5).forEach(token => {
      const balance = parseFloat(token.balance) / Math.pow(10, token.decimals);
      console.log(`   - ${token.symbol}: ${balance.toFixed(4)} ${token.usd_value ? `($${token.usd_value.toFixed(2)})` : ''}`);
    });
    console.log('');

    console.log('3️⃣ Testing transaction history...');
    const transactions = await getWalletTransactions(walletAddress, 'eth', 10);
    console.log(`   Found ${transactions.length} recent transactions`);
    transactions.slice(0, 3).forEach(tx => {
      console.log(`   - ${tx.hash.substring(0, 10)}... at ${tx.block_timestamp}`);
    });
    console.log('');

    console.log('4️⃣ Testing DeFi positions...');
    const defiPositions = await getWalletDeFiPositions(walletAddress);
    console.log(`   Found ${defiPositions.length} DeFi positions`);
    defiPositions.slice(0, 3).forEach(pos => {
      console.log(`   - ${pos.protocol_name}: ${pos.position_type} ${pos.total_usd_value ? `($${pos.total_usd_value.toFixed(2)})` : ''}`);
    });
    console.log('');

    console.log('5️⃣ Testing protocol interactions...');
    const protocols = await getWalletProtocols(walletAddress);
    console.log(`   Found ${protocols.length} known protocols`);
    protocols.forEach(protocol => {
      console.log(`   - ${protocol}`);
    });
    console.log('');

    console.log('6️⃣ Testing comprehensive analysis...');
    const analysis = await getComprehensiveWalletAnalysis(walletAddress);
    console.log(`   Portfolio Value: $${analysis.total_portfolio_value.toFixed(2)}`);
    console.log(`   Asset Count: ${analysis.assets.length}`);
    console.log(`   Transactions (30d): ${analysis.transaction_count_30d}`);
    console.log(`   DeFi Positions: ${analysis.defi_positions.length}`);
    console.log(`   Protocols: ${analysis.protocols_interacted.length}`);
    console.log('');

    console.log('7️⃣ Testing risk formatting...');
    const formatted = formatWalletAnalysisForRisk(analysis);
    console.log('   Formatted analysis preview:');
    console.log(formatted.substring(0, 500) + '...\n');

    console.log('✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    process.exit(1);
  }
}

// Run the test
testWalletAnalysis().catch(console.error);