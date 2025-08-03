#!/usr/bin/env npx tsx

/**
 * Test script for the new GPT-powered wallet risk analysis architecture
 * 
 * Usage: npx tsx scripts/test-analyzer.ts [wallet_address]
 * Example: npx tsx scripts/test-analyzer.ts 0xd8da6bf26964af9d7eed9e03e53415d37aa96045
 */

import * as dotenv from 'dotenv';
import WalletRiskAnalyzer from './walletRiskAnalyzer';

// Load environment variables
dotenv.config();

async function testNewArchitecture(address: string) {
  console.log(`🚀 Testing new architecture for wallet: ${address}\n`);

  try {
    // Check required environment variables
    const requiredEnvVars = [
      'ZERION_API_KEY',
      'MORALIS_API_KEY', 
      'OPENAI_API_KEY'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('❌ Missing required environment variables:');
      missingVars.forEach(varName => {
        console.error(`   - ${varName}`);
      });
      console.log('\nPlease add these to your .env file');
      process.exit(1);
    }

    // Initialize the analyzer
    console.log('🔧 Initializing WalletRiskAnalyzer...');
    const analyzer = new WalletRiskAnalyzer();
    console.log('✅ Analyzer initialized\n');

    // Run comprehensive analysis
    console.log('🔍 Running comprehensive analysis...');
    console.log('   This may take a few moments as we:');
    console.log('   • Fetch data from Zerion, Moralis, and Dune');
    console.log('   • Run GPT-powered asset analysis');
    console.log('   • Run GPT-powered pool analysis');
    console.log('   • Generate final GPT risk assessment');
    console.log('   • Store results in JSON files\n');

    const startTime = Date.now();
    
    const result = await analyzer.analyzeWallet(address, {
      forceRefresh: true,
      maxAgeMinutes: 1,
      skipDune: false // Set to true if you don't have Dune API key
    });

    const analysisTime = Date.now() - startTime;
    
    console.log('✅ Analysis completed!\n');
    console.log('=' .repeat(60));
    console.log('📊 COMPREHENSIVE RISK ANALYSIS RESULTS');
    console.log('=' .repeat(60));
    
    // Display results
    console.log(`\n🎯 FINAL RISK ASSESSMENT:`);
    if (result.final_analysis) {
      console.log(`   Overall Risk Score: ${result.final_analysis.overall_risk_score}/100`);
      console.log(`   Risk Level: ${result.final_analysis.risk_level.toUpperCase()}`);
      console.log(`   Confidence: ${result.final_analysis.confidence_score}%`);
      console.log(`   \n📝 GPT Summary:`);
      console.log(`   ${result.final_analysis.gpt_summary}\n`);

      if (result.final_analysis.key_risks.length > 0) {
        console.log(`🚨 KEY RISKS:`);
        result.final_analysis.key_risks.forEach(risk => {
          console.log(`   • ${risk}`);
        });
        console.log();
      }

      if (result.final_analysis.recommendations.length > 0) {
        console.log(`💡 RECOMMENDATIONS:`);
        result.final_analysis.recommendations.forEach(rec => {
          console.log(`   • ${rec}`);
        });
        console.log();
      }

      if (result.final_analysis.alerts.length > 0) {
        console.log(`⚠️  ALERTS:`);
        result.final_analysis.alerts.forEach(alert => {
          const emoji = alert.severity === 'critical' ? '🚨' : 
                       alert.severity === 'high' ? '❌' : 
                       alert.severity === 'medium' ? '⚠️' : 'ℹ️';
          console.log(`   ${emoji} [${alert.severity.toUpperCase()}] ${alert.message}`);
        });
        console.log();
      }
    } else {
      console.log('   ❌ Final analysis not completed');
    }

    // Display individual analysis results
    console.log(`📈 INDIVIDUAL ANALYSIS RESULTS:`);
    
    if (result.individual_analyses.assets) {
      console.log(`\n🪙 ASSET ANALYSIS:`);
      console.log(`   Risk Score: ${result.individual_analyses.assets.risk_score}/100`);
      console.log(`   Key Findings: ${result.individual_analyses.assets.key_findings.join(', ')}`);
      console.log(`   GPT Analysis: ${result.individual_analyses.assets.gpt_analysis.substring(0, 200)}...`);
    }

    if (result.individual_analyses.pools) {
      console.log(`\n🏊 POOL ANALYSIS:`);
      console.log(`   Risk Score: ${result.individual_analyses.pools.risk_score}/100`);
      console.log(`   Key Findings: ${result.individual_analyses.pools.key_findings.join(', ')}`);
      console.log(`   GPT Analysis: ${result.individual_analyses.pools.gpt_analysis.substring(0, 200)}...`);
    }

    if (result.individual_analyses.protocols) {
      console.log(`\n🏗️  PROTOCOL ANALYSIS:`);
      console.log(`   Risk Score: ${result.individual_analyses.protocols.risk_score}/100`);
      console.log(`   Key Findings: ${result.individual_analyses.protocols.key_findings.join(', ')}`);
      console.log(`   GPT Analysis: ${result.individual_analyses.protocols.gpt_analysis.substring(0, 200)}...`);
    }

    // Display metadata
    console.log(`\n📋 ANALYSIS METADATA:`);
    console.log(`   Version: ${result.metadata.analysis_version}`);
    console.log(`   Last Updated: ${result.metadata.last_updated}`);
    console.log(`   Data Sources: ${result.metadata.data_sources.join(', ')}`);
    console.log(`   Processing Time: ${analysisTime}ms`);
    console.log(`   Analysis Complete: ${result.analysis_complete ? 'Yes' : 'No'}`);

    // Display data file location
    console.log(`\n📁 DATA STORAGE:`);
    console.log(`   JSON data file created at: data/wallets/${address.toLowerCase().replace(/[^a-z0-9]/g, '')}.json`);
    console.log(`   This file contains all raw data and analysis results`);
    console.log(`   Frontend can consume this JSON directly without API calls`);

    // Test data stats
    console.log(`\n📊 DATA STATISTICS:`);
    const stats = await analyzer.getDataStats();
    console.log(`   Total analyzed wallets: ${stats.total_wallets}`);
    console.log(`   Data directory size: ${stats.total_size_mb} MB`);
    console.log(`   Oldest analysis: ${stats.oldest_analysis || 'N/A'}`);
    console.log(`   Newest analysis: ${stats.newest_analysis || 'N/A'}`);

    console.log(`\n✅ New architecture test completed successfully!`);
    console.log(`🎉 Analysis took ${analysisTime}ms and all data is persisted in JSON format`);

  } catch (error: any) {
    console.error('❌ New architecture test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Test getting analysis status
async function testAnalysisStatus(address: string) {
  console.log(`\n📊 Testing analysis status for: ${address}`);
  
  try {
    const analyzer = new WalletRiskAnalyzer();
    const status = await analyzer.getAnalysisStatus(address);
    
    console.log(`   Analysis exists: ${status.exists}`);
    if (status.exists) {
      console.log(`   Last updated: ${status.last_updated}`);
      console.log(`   Completed analyses: ${status.analyses_complete.join(', ')}`);
      console.log(`   Final analysis complete: ${status.final_analysis_complete}`);
    }
  } catch (error: any) {
    console.error('Status check failed:', error.message);
  }
}

// Main execution
async function main() {
  const address = process.argv[2];
  
  if (!address) {
    console.log('Usage: npx tsx scripts/test-analyzer.ts [wallet_address]');
    console.log('Example: npx tsx scripts/test-analyzer.ts 0xd8da6bf26964af9d7eed9e03e53415d37aa96045');
    console.log('\nEnvironment variables required:');
    console.log('• ZERION_API_KEY - Get from Zerion');
    console.log('• MORALIS_API_KEY - Get from Moralis');
    console.log('• OPENAI_API_KEY - Get from OpenAI');
    console.log('• DUNE_API_KEY - Get from Dune (optional)');
    process.exit(1);
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    console.error('❌ Invalid Ethereum address format');
    process.exit(1);
  }

  // Test analysis status first
  await testAnalysisStatus(address);
  
  // Run full analysis
  await testNewArchitecture(address);
}

if (require.main === module) {
  main();
}

export { testNewArchitecture };