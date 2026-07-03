import axios from "axios";
import * as nacl from "tweetnacl";
import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const envPath = path.resolve(__dirname, "../.env");

const CONFIG = {
  mainnet: {
    apiOrigin: "https://txline.txodds.com",
  },
  devnet: {
    apiOrigin: "https://txline-dev.txodds.com",
  },
} as const;

async function main() {
  const network = (process.env.NETWORK || "devnet").toLowerCase() as "mainnet" | "devnet";
  const { apiOrigin } = CONFIG[network];
  const apiBaseUrl = `${apiOrigin}/api`;

  const txSig = process.env.TX_SIG;
  if (!txSig) {
    console.error("Error: TX_SIG not set in .env. Please run subscription first.");
    process.exit(1);
  }

  const secretKeyString = process.env.WALLET_SECRET_KEY;
  if (!secretKeyString) {
    console.error("Error: WALLET_SECRET_KEY not set in .env");
    process.exit(1);
  }

  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  const keypair = Keypair.fromSecretKey(secretKey);

  console.log(`Activating API token on ${network}...`);
  console.log(`Wallet Public Key: ${keypair.publicKey.toBase58()}`);
  console.log(`Subscription Tx Signature: ${txSig}`);

  // Step 1: Get guest authentication token
  const guestStartUrl = `${apiOrigin}/auth/guest/start`;
  console.log(`1. Requesting guest session JWT from: ${guestStartUrl}`);
  
  let jwt = "";
  try {
    const authResponse = await axios.post(guestStartUrl);
    jwt = authResponse.data.token;
    console.log(`   Guest JWT acquired successfully.`);
  } catch (error: any) {
    console.error("Failed to request guest token:", error.response?.data || error.message);
    process.exit(1);
  }

  // Step 2: Create and sign the activation message
  const selectedLeagues: number[] = []; // Empty for standard World Cup free bundle
  const messageString = `${txSig}:${selectedLeagues.join(",")}:${jwt}`;
  console.log(`2. Constructing activation message: "${messageString}"`);
  
  const messageBytes = new TextEncoder().encode(messageString);
  const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
  const walletSignature = Buffer.from(signatureBytes).toString("base64");
  console.log("   Message signed cryptographically.");

  // Step 3: Activate API access
  const activateUrl = `${apiBaseUrl}/token/activate`;
  console.log(`3. Sending activation request to: ${activateUrl}`);
  
  try {
    const activationResponse = await axios.post(
      activateUrl,
      {
        txSig,
        walletSignature,
        leagues: selectedLeagues,
      },
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      }
    );

    const apiToken = activationResponse.data.token || activationResponse.data;
    console.log("   API Token activated successfully!");
    console.log(`   API Token: ${apiToken}`);

    // Update .env with JWT and API Token
    let envContent = fs.readFileSync(envPath, "utf-8");
    
    // Save GUEST_JWT
    if (envContent.includes("GUEST_JWT=")) {
      envContent = envContent.replace(/GUEST_JWT=.*/, `GUEST_JWT=${jwt}`);
    } else {
      envContent += `\nGUEST_JWT=${jwt}\n`;
    }
    
    // Save API_TOKEN
    if (envContent.includes("API_TOKEN=")) {
      envContent = envContent.replace(/API_TOKEN=.*/, `API_TOKEN=${apiToken}`);
    } else {
      envContent += `\nAPI_TOKEN=${apiToken}\n`;
    }

    fs.writeFileSync(envPath, envContent, "utf-8");
    console.log("Saved GUEST_JWT and API_TOKEN to .env.");
  } catch (error: any) {
    console.error("Failed to activate token:", error.response?.data || error.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
