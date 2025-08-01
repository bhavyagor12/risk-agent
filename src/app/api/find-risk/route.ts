// scripts/generate-risk.ts
import fs from "fs";
import path from "path";
import { ChatOpenAI } from "@langchain/openai";
import { createSingleRunGraph } from "@langchain/langgraph";

const model = new ChatOpenAI({ modelName: "gpt-4" });

const wallets = [
  "0x7a29aE65Bf25Dfb6e554BF0468a6c23ed99a8DC2",
  "0x3feC8fd95b122887551c19c73F6b2bbf445B8C87",
  "0x38e247893BbC8517a317c54Ed34F9C62cb5F26c0",
  "0x51db92258a3ab0f81de0feab5d59a77e49b57275",
];

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

Do not repeat the raw input — use it only to reason and output insights.
`;

async function run() {
  for (const address of wallets) {
    const walletInput = await getMockWalletContext(address);

    const graph = await createSingleRunGraph({
      steps: [
        {
          id: "generateRisk",
          func: model.bind({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: walletInput },
            ],
          }),
        },
      ],
      entryPoint: "generateRisk",
    });

    const result = await graph.invoke();

    const jsonStr = result.output?.content;
    const filename = path.join(
      process.cwd(),
      "public",
      "static",
      "risk",
      `${address}.json`,
    );
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, jsonStr, "utf8");

    console.log(`✅ Wrote risk file for ${address}`);
  }
}

async function getMockWalletContext(address: string): Promise<string> {
  return `
Wallet address: ${address}

Assets Held:
- USDC: 1200
- PEPE: 800000
- SHADYDAO: 500

Protocols Used:
- Aave v3: supplied USDC
- SushiSwap: provided LP in PEPE/USDC
- RugSwap: staked SHADYDAO

Pools:
- USDC/PEPE (SushiSwap)
- SHADYDAO/ETH (RugSwap)

Tx Count (30d): 72
Contract Interactions: Yes
Tornado Cash Activity: No
`.trim();
}

run();
