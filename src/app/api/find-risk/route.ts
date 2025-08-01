import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from "@langchain/openai";
import { 
  initializeMoralis, 
  getComprehensiveWalletAnalysis, 
  formatWalletAnalysisForRisk,
  type WalletAnalysis 
} from '@/lib/moralis-wallet-analyzer';

const model = new ChatOpenAI({ modelName: "gpt-4", temperature: 0 });

const systemPrompt = `
You're a blockchain risk analyst. Based on the onchain activity I give you, output a JSON object with the following schema:

{
  "wallet": "0x...",
  "risk_score": 0-100,
  "summary": "short one-liner",
  "key_factors": ["..."],
  "concerns": ["..."],
  "confidence_level": "high | medium | low",
  "final_notes": "..."
}

Risk scoring guidelines:
- 0-20: Very Low Risk (established wallets, diversified holdings, no red flags)
- 21-40: Low Risk (good activity history, minor concerns)
- 41-60: Medium Risk (some concerns, limited history, or concentrated holdings)
- 61-80: High Risk (multiple red flags, suspicious activity, or high concentration)
- 81-100: Very High Risk (severe red flags, mixer usage, or highly suspicious patterns)

Do not repeat the raw input — use it only to reason and output insights.
Return only the JSON, nothing else.
`;

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address format' },
        { status: 400 }
      );
    }

    // Initialize Moralis
    const apiKey = process.env.MORALIS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Moralis API key not configured' },
        { status: 500 }
      );
    }

    await initializeMoralis(apiKey);

    // Get comprehensive wallet analysis
    console.log(`🔍 Analyzing wallet: ${address}`);
    const walletAnalysis = await getComprehensiveWalletAnalysis(address);
    
    // Format for AI analysis
    const formattedAnalysis = formatWalletAnalysisForRisk(walletAnalysis);

    // Get AI risk assessment
    const aiResponse = await model.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: formattedAnalysis },
    ]);

    let riskAssessment;
    try {
      riskAssessment = JSON.parse(aiResponse.content as string);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse.content);
      return NextResponse.json(
        { error: 'Failed to generate risk assessment' },
        { status: 500 }
      );
    }

    // Combine the raw analysis with AI assessment
    const response = {
      ...riskAssessment,
      raw_analysis: walletAnalysis,
      analysis_timestamp: new Date().toISOString(),
    };

    console.log(`✅ Risk analysis completed for ${address}`);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in risk analysis:', error);
    return NextResponse.json(
      { 
        error: 'Failed to analyze wallet risk',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json(
      { error: 'Wallet address parameter is required' },
      { status: 400 }
    );
  }

  // Convert GET to POST call internally
  return POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ address }),
    headers: { 'Content-Type': 'application/json' }
  }));
}
