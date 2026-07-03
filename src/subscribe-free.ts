import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const envPath = path.resolve(__dirname, "../.env");

const CONFIG = {
  mainnet: {
    programId: new PublicKey("9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA"),
    txlTokenMint: new PublicKey("Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL"),
  },
  devnet: {
    programId: new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"),
    txlTokenMint: new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG"),
  },
} as const;

async function main() {
  const network = (process.env.NETWORK || "devnet").toLowerCase() as "mainnet" | "devnet";
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const serviceLevelId = parseInt(process.env.SERVICE_LEVEL_ID || "1", 10);
  const durationWeeks = parseInt(process.env.DURATION_WEEKS || "4", 10);

  const secretKeyString = process.env.WALLET_SECRET_KEY;
  if (!secretKeyString) {
    console.error("Error: WALLET_SECRET_KEY not set in .env");
    process.exit(1);
  }

  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  const keypair = Keypair.fromSecretKey(secretKey);

  console.log(`Wallet Public Key: ${keypair.publicKey.toBase58()}`);
  console.log(`Selected Network: ${network}`);
  console.log(`Connecting to Solana RPC: ${rpcUrl}`);

  const connection = new Connection(rpcUrl, "confirmed");
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const { programId, txlTokenMint } = CONFIG[network];

  // Load IDL dynamically
  const idlPath = path.resolve(__dirname, `idl/txoracle_${network}.json`);
  if (!fs.existsSync(idlPath)) {
    throw new Error(`IDL file not found at ${idlPath}`);
  }
  const txoracleIdl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  // Initialize Anchor Program
  const program = new anchor.Program(txoracleIdl as any, provider) as any;

  if (!program.programId.equals(programId)) {
    throw new Error(
      `Loaded IDL program ${program.programId.toBase58()} does not match ${network} programId ${programId.toBase58()}`
    );
  }

  console.log("Deriving program addresses...");
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    program.programId
  );

  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    txlTokenMint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    program.programId
  );

  const userTokenAccount = getAssociatedTokenAddressSync(
    txlTokenMint,
    keypair.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  console.log(`Checking if Associated Token Account exists: ${userTokenAccount.toBase58()}`);
  const userTokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
  if (!userTokenAccountInfo) {
    console.log("Associated Token Account does not exist. Initializing it now...");
    const { createAssociatedTokenAccountInstruction } = require("@solana/spl-token");
    const { Transaction, sendAndConfirmTransaction } = require("@solana/web3.js");
    
    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        keypair.publicKey, // payer
        userTokenAccount,  // associatedTokenAddress
        keypair.publicKey, // owner
        txlTokenMint,      // mint
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    
    const ataTxSig = await sendAndConfirmTransaction(connection, transaction, [keypair]);
    console.log(`Associated Token Account initialized successfully! Tx: ${ataTxSig}`);
  } else {
    console.log("Associated Token Account already exists.");
  }

  console.log(`Subscribing to Service Level ${serviceLevelId} for ${durationWeeks} weeks...`);

  try {
    const txSig = await program.methods
      .subscribe(serviceLevelId, durationWeeks)
      .accounts({
        user: keypair.publicKey,
        pricingMatrix: pricingMatrixPda,
        tokenMint: txlTokenMint,
        userTokenAccount,
        tokenTreasuryVault,
        tokenTreasuryPda,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Subscription transaction successful!");
    console.log(`Transaction Signature: ${txSig}`);

    // Save transaction signature to .env
    let envContent = fs.readFileSync(envPath, "utf-8");
    if (envContent.includes("TX_SIG=")) {
      envContent = envContent.replace(/TX_SIG=.*/, `TX_SIG=${txSig}`);
    } else {
      envContent += `\nTX_SIG=${txSig}\n`;
    }
    fs.writeFileSync(envPath, envContent, "utf-8");
    console.log("Saved TX_SIG to .env.");
  } catch (error: any) {
    console.error("Subscription failed:", error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
