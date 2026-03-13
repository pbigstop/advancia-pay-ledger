import { FireblocksSDK, PeerType } from "fireblocks-sdk";
import { prisma } from "../lib/prisma";
import { getExplorerUrl } from "./withdrawalService";

let fireblocks: FireblocksSDK | null = null;
if (process.env.FIREBLOCKS_API_SECRET && process.env.FIREBLOCKS_API_KEY) {
  fireblocks = new FireblocksSDK(
    process.env.FIREBLOCKS_API_SECRET,
    process.env.FIREBLOCKS_API_KEY,
  );
}

export async function withdrawViaFireblocks(params: {
  facilityId: string;
  chain: string;
  token: string;
  toAddress: string;
  amount: number;
}): Promise<{ txHash: string; explorerUrl: string }> {
  const { facilityId, token, toAddress, amount, chain } = params;

  if (!fireblocks) {
    throw new Error("Fireblocks SDK not initialized - missing credentials");
  }

  // Map our token names to Fireblocks asset IDs
  const assetIdMap: Record<string, string> = {
    SOL: "SOL",
    ETH: "ETH",
    USDC: "USDC",
    USDT: "USDT",
    MATIC: "MATIC_POLYGON",
  };

  const assetId = assetIdMap[token];
  if (!assetId) {
    throw new Error(`Unsupported token for Fireblocks withdrawal: ${token}`);
  }

  try {
    const tx = await fireblocks.createTransaction({
      assetId,
      amount: amount.toString(),
      source: { type: PeerType.VAULT_ACCOUNT, id: "0" }, // Using default vault
      destination: {
        type: PeerType.ONE_TIME_ADDRESS,
        oneTimeAddress: { address: toAddress },
      },
      note: `Advancia withdrawal for ${facilityId}`,
    });

    const txId = tx.id;
    // Note: Fireblocks transactions are asynchronous.
    // The actual txHash will be populated when the transaction completes on-chain.
    // For this implementation, we return the internal Fireblocks txId as a placeholder.

    return {
      txHash: txId,
      explorerUrl: getExplorerUrl(chain, txId),
    };
  } catch (error: any) {
    console.error("[Fireblocks] Transaction failed:", error);
    throw new Error(`Fireblocks execution failed: ${error.message}`);
  }
}
