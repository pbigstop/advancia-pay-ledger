import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} from "@solana/spl-token";
import { ethers } from "ethers";
import bs58 from "bs58";
import { PrismaClient } from "@prisma/client";
import { withdrawViaFireblocks } from "./fireblocksService";

const prisma = new PrismaClient();

// ─── Token Addresses ────────────────────────────────────────────────────────

export const SPL_MINTS: Record<string, string> = {
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
};

export const ERC20_ADDRESSES: Record<string, Record<string, string>> = {
  ethereum: {
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  polygon: {
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  },
  base: {
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
};

export const RPC_URLS: Record<string, string> = {
  solana: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  ethereum: process.env.ETH_RPC_URL || "https://eth.llamarpc.com",
  polygon: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
  base: process.env.BASE_RPC_URL || "https://mainnet.base.org",
};

export function getExplorerUrl(chain: string, txHash: string): string {
  const urls: Record<string, string> = {
    solana: `https://solscan.io/tx/${txHash}`,
    ethereum: `https://etherscan.io/tx/${txHash}`,
    polygon: `https://polygonscan.com/tx/${txHash}`,
    base: `https://basescan.org/tx/${txHash}`,
  };
  return urls[chain] ?? `#${txHash}`;
}

// ─── ERC-20 ABI (minimal transfer) ──────────────────────────────────────────

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
];

// ─── Solana Withdrawals ──────────────────────────────────────────────────────

async function getSolanaWallet(): Promise<Keypair> {
  const key = process.env.SOLANA_TREASURY_PRIVATE_KEY;
  if (!key) throw new Error("SOLANA_TREASURY_PRIVATE_KEY not set");
  return Keypair.fromSecretKey(bs58.decode(key));
}

export async function withdrawSOL(
  toAddress: string,
  amountSOL: number,
  facilityId: string,
): Promise<string> {
  const connection = new Connection(RPC_URLS.solana, "confirmed");
  const wallet = await getSolanaWallet();
  const toPubkey = new PublicKey(toAddress);

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey,
      lamports: Math.round(amountSOL * LAMPORTS_PER_SOL),
    }),
  );

  const txHash = await sendAndConfirmTransaction(connection, tx, [wallet]);
  await auditLog({
    facilityId,
    chain: "solana",
    token: "SOL",
    to: toAddress,
    amount: amountSOL,
    txHash,
  });
  return txHash;
}

export async function withdrawSPLToken(
  toAddress: string,
  amount: number,
  mintAddress: string,
  decimals: number,
  facilityId: string,
  token: string,
): Promise<string> {
  const connection = new Connection(RPC_URLS.solana, "confirmed");
  const wallet = await getSolanaWallet();
  const toPubkey = new PublicKey(toAddress);
  const mint = new PublicKey(mintAddress);

  const fromATA = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet,
    mint,
    wallet.publicKey,
  );
  const toATA = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet,
    mint,
    toPubkey,
  );

  const amountUnits = BigInt(Math.round(amount * 10 ** decimals));

  const tx = new Transaction().add(
    createTransferInstruction(
      fromATA.address,
      toATA.address,
      wallet.publicKey,
      amountUnits,
    ),
  );

  const txHash = await sendAndConfirmTransaction(connection, tx, [wallet]);
  await auditLog({
    facilityId,
    chain: "solana",
    token,
    to: toAddress,
    amount,
    txHash,
  });
  return txHash;
}

// ─── EVM Withdrawals ─────────────────────────────────────────────────────────

function getEVMWallet(chain: string): ethers.Wallet {
  const key = process.env.EVM_TREASURY_PRIVATE_KEY;
  if (!key) throw new Error("EVM_TREASURY_PRIVATE_KEY not set");
  const provider = new ethers.JsonRpcProvider(RPC_URLS[chain]);
  return new ethers.Wallet(key, provider);
}

export async function withdrawNativeEVM(
  toAddress: string,
  amount: number,
  chain: "ethereum" | "polygon" | "base",
  facilityId: string,
  token: string,
): Promise<string> {
  const wallet = getEVMWallet(chain);
  const tx = await wallet.sendTransaction({
    to: toAddress,
    value: ethers.parseEther(amount.toString()),
  });
  const receipt = await tx.wait();
  const txHash = receipt!.hash;
  await auditLog({ facilityId, chain, token, to: toAddress, amount, txHash });
  return txHash;
}

export async function withdrawERC20(
  toAddress: string,
  amount: number,
  tokenAddress: string,
  chain: "ethereum" | "polygon" | "base",
  facilityId: string,
  token: string,
): Promise<string> {
  const wallet = getEVMWallet(chain);
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
  const decimals: number = await contract.decimals();
  const amountUnits = ethers.parseUnits(amount.toString(), decimals);

  const tx = await contract.transfer(toAddress, amountUnits);
  const receipt = await tx.wait();
  const txHash = receipt!.hash;
  await auditLog({ facilityId, chain, token, to: toAddress, amount, txHash });
  return txHash;
}

// ─── Unified Withdraw Entry Point ────────────────────────────────────────────

export interface WithdrawParams {
  facilityId: string;
  chain: "solana" | "ethereum" | "polygon" | "base";
  token: string;
  toAddress: string;
  amount: number;
  initiatedBy: string;
  note?: string;
}

export async function executeWithdrawal(
  params: WithdrawParams,
): Promise<{ txHash: string; explorerUrl: string }> {
  const { facilityId, chain, token, toAddress, amount, initiatedBy, note } =
    params;

  const record = await prisma.cryptoWithdrawal.create({
    data: {
      facilityId,
      chain,
      token,
      toAddress,
      amount,
      initiatedBy,
      note,
      status: "PENDING",
    },
  });

  let txHash: string;
  let explorerUrl: string;

  try {
    if (process.env.FIREBLOCKS_API_SECRET && process.env.FIREBLOCKS_API_KEY) {
      const fbResult = await withdrawViaFireblocks({
        facilityId,
        chain,
        token,
        toAddress,
        amount,
      });
      txHash = fbResult.txHash;
      explorerUrl = fbResult.explorerUrl;
    } else {
      if (chain === "solana") {
        if (token === "SOL") {
          txHash = await withdrawSOL(toAddress, amount, facilityId);
        } else {
          const mint = SPL_MINTS[token];
          if (!mint) throw new Error(`Unknown SPL token: ${token}`);
          txHash = await withdrawSPLToken(
            toAddress,
            amount,
            mint,
            6,
            facilityId,
            token,
          );
        }
      } else {
        const tokenAddr = ERC20_ADDRESSES[chain]?.[token];
        if (token === "ETH" || token === "MATIC") {
          txHash = await withdrawNativeEVM(
            toAddress,
            amount,
            chain as "ethereum" | "polygon" | "base",
            facilityId,
            token,
          );
        } else {
          if (!tokenAddr) throw new Error(`No ${token} address for ${chain}`);
          txHash = await withdrawERC20(
            toAddress,
            amount,
            tokenAddr,
            chain as "ethereum" | "polygon" | "base",
            facilityId,
            token,
          );
        }
      }
      explorerUrl = getExplorerUrl(chain, txHash);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.cryptoWithdrawal.update({
      where: { id: record.id },
      data: { status: "FAILED", errorMessage: message },
    });
    throw err;
  }

  await prisma.cryptoWithdrawal.update({
    where: { id: record.id },
    data: { status: "COMPLETED", txHash, completedAt: new Date() },
  });

  return { txHash, explorerUrl: getExplorerUrl(chain, txHash) };
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

async function auditLog(data: {
  facilityId: string;
  chain: string;
  token: string;
  to: string;
  amount: number;
  txHash: string;
}) {
  await prisma.auditLog
    .create({
      data: {
        action: "CRYPTO_WITHDRAWAL",
        entityType: "CryptoWithdrawal",
        metadata: JSON.stringify(data),
        facilityId: data.facilityId,
      },
    })
    .catch(() => {}); // never let audit failure block withdraw
}
