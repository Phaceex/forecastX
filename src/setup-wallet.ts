import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const envPath = path.resolve(__dirname, "../.env");

async function main() {
  let secretKeyString = process.env.WALLET_SECRET_KEY;
  let keypair: Keypair;

  if (!secretKeyString || secretKeyString.trim() === "") {
    console.log("No WALLET_SECRET_KEY found in .env. Generating a new Solana keypair...");
    keypair = Keypair.generate();
    const secretKeyArray = Array.from(keypair.secretKey);
    const secretKeyJson = JSON.stringify(secretKeyArray);

    // Update .env file
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf-8");
    }

    if (envContent.includes("WALLET_SECRET_KEY=")) {
      envContent = envContent.replace(/WALLET_SECRET_KEY=.*/, `WALLET_SECRET_KEY=${secretKeyJson}`);
    } else {
      envContent += `\nWALLET_SECRET_KEY=${secretKeyJson}\n`;
    }

    fs.writeFileSync(envPath, envContent, "utf-8");
    console.log("Generated keypair and saved to .env.");
  } else {
    try {
      const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
      keypair = Keypair.fromSecretKey(secretKey);
      console.log("Loaded existing keypair from .env.");
    } catch (e: any) {
      console.error("Failed to parse WALLET_SECRET_KEY from .env:", e.message);
      process.exit(1);
    }
  }

  console.log(`Public Key: ${keypair.publicKey.toBase58()}`);

  const network = process.env.NETWORK || "devnet";
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  console.log(`Connecting to ${network} via RPC: ${rpcUrl}`);
  
  const connection = new Connection(rpcUrl, "confirmed");

  let balance = await connection.getBalance(keypair.publicKey);
  console.log(`Wallet Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

  if (network.toLowerCase() === "devnet" && balance < 0.05 * LAMPORTS_PER_SOL) {
    console.log("Balance is low. Requesting airdrop of 0.1 SOL...");
    let retries = 3;
    let success = false;
    
    while (retries > 0 && !success) {
      try {
        const signature = await connection.requestAirdrop(keypair.publicKey, 0.1 * LAMPORTS_PER_SOL);
        
        // Wait for transaction confirmation
        const latestBlockHash = await connection.getLatestBlockhash();
        await connection.confirmTransaction({
          blockhash: latestBlockHash.blockhash,
          lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
          signature: signature
        }, "confirmed");
        
        balance = await connection.getBalance(keypair.publicKey);
        console.log(`Airdrop successful! New Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
        success = true;
      } catch (error: any) {
        retries--;
        console.error(`Airdrop attempt failed (${retries} retries left):`, error.message);
        if (retries > 0) {
          console.log("Waiting 5 seconds before retrying...");
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    }
    
    if (!success) {
      console.log("Please fund your wallet manually if the devnet faucet fails.");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
