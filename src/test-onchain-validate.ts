import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, ComputeBudgetProgram, Keypair } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import axios from "axios";
import * as path from "path";
import dotenv from "dotenv";
import txoracleIdl from "./idl/txoracle_devnet.json";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

function toBytes32(value: string | number[] | Uint8Array): number[] {
  const bytes = Array.isArray(value) ? Uint8Array.from(value) :
                value instanceof Uint8Array ? value :
                value.startsWith("0x") ? Buffer.from(value.slice(2), "hex") :
                Buffer.from(value, "base64");
  if (bytes.length !== 32) {
    throw new Error(`Expected 32 bytes, received ${bytes.length}`);
  }
  return Array.from(bytes);
}

function toProofNodes(nodes: Array<{ hash: string | number[] | Uint8Array; isRightSibling: boolean }>) {
  return nodes.map((node) => ({
    hash: toBytes32(node.hash),
    isRightSibling: node.isRightSibling,
  }));
}

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  const secretKeyString = process.env.WALLET_SECRET_KEY;
  if (!secretKeyString) {
    console.error("Error: WALLET_SECRET_KEY not set in .env");
    process.exit(1);
  }
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  const keypair = Keypair.fromSecretKey(secretKey);
  const wallet = new anchor.Wallet(keypair);

  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const program = new anchor.Program(txoracleIdl as any, provider) as any;

  const client = axios.create({
    baseURL: "https://txline-dev.txodds.com",
    headers: {
      Authorization: `Bearer ${process.env.GUEST_JWT}`,
      "X-Api-Token": process.env.API_TOKEN,
    },
  });

  console.log("Fetching stat-validation payload from TxLINE gateway...");
  const response = await client.get("/api/scores/stat-validation", {
    params: { fixtureId: 18179550, seq: 698, statKey: 2 },
  });
  const v = response.data;

  console.log("Successfully fetched payload. Parsing structure...");

  const fixtureSummary = {
    fixtureId: new BN(v.summary.fixtureId),
    updateStats: {
      updateCount: v.summary.updateStats.updateCount,
      minTimestamp: new BN(v.summary.updateStats.minTimestamp),
      maxTimestamp: new BN(v.summary.updateStats.maxTimestamp),
    },
    eventsSubTreeRoot: toBytes32(v.summary.eventStatsSubTreeRoot),
  };

  const stat1 = {
    statToProve: {
      key: v.statToProve.key,
      value: v.statToProve.value,
      period: v.statToProve.period,
    },
    eventStatRoot: toBytes32(v.eventStatRoot),
    statProof: toProofNodes(v.statProof),
  };

  const predicate = { threshold: 0, comparison: { greaterThan: {} } };

  // targetTs is minTimestamp for daily roots PDA seed generation
  const targetTs = v.summary.updateStats.minTimestamp;
  const epochDay = Math.floor(targetTs / (24 * 60 * 60 * 1000));

  console.log(`v.ts: ${v.ts}`);
  console.log(`minTimestamp: ${v.summary.updateStats.minTimestamp}`);
  console.log(`maxTimestamp: ${v.summary.updateStats.maxTimestamp}`);
  console.log(`targetTs: ${targetTs}, epochDay: ${epochDay}`);

  const [dailyScoresPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), new BN(epochDay).toArrayLike(Buffer, "le", 2)],
    program.programId
  );

  console.log(`Derived dailyScoresPda: ${dailyScoresPda.toBase58()}`);

  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });

  const mappedSubTreeProof = toProofNodes(v.subTreeProof);
  const mappedMainTreeProof = toProofNodes(v.mainTreeProof);

  console.log("Calling validateStat on-chain (.view())...");

  const isValid = await program.methods
    .validateStat(
      new BN(targetTs),
      fixtureSummary,
      mappedSubTreeProof,
      mappedMainTreeProof,
      predicate,
      stat1,
      null, // stat_b (Option)
      null  // op (Option)
    )
    .accounts({ dailyScoresMerkleRoots: dailyScoresPda })
    .preInstructions([computeBudgetIx])
    .view();

  console.log("\n=============================================");
  console.log("Valid:", isValid);
  console.log("=============================================\n");
}

main().catch((err) => {
  console.error("Error during onchain validation:");
  console.error(err);
});
