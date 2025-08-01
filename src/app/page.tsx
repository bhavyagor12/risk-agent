// app/wallet-risk/page.tsx
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WalletTab from "@/components/wallet-tab";

const wallets = [
  {
    address: "0x7a29aE65Bf25Dfb6e554BF0468a6c23ed99a8DC2",
    label: "Wallet 1",
  },
  {
    address: "0x3feC8fd95b122887551c19c73F6b2bbf445B8C87",
    label: "Wallet 2",
  },
  {
    address: "0x38e247893BbC8517a317c54Ed34F9C62cb5F26c0",
    label: "Wallet 3",
  },
  {
    address: "0x51db92258a3ab0f81de0feab5d59a77e49b57275",
    label: "Wallet 4",
  },
];

export default function WalletRiskPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Wallet Risk Evaluation</h1>
      <Tabs defaultValue={wallets[0].address} className="w-full">
        <TabsList>
          {wallets.map((wallet) => (
            <TabsTrigger key={wallet.address} value={wallet.address}>
              {wallet.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {wallets.map((wallet) => (
          <TabsContent key={wallet.address} value={wallet.address}>
            <WalletTab address={wallet.address} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
