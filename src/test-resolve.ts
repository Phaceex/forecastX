import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, ComputeBudgetProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import axios from "axios";
import idl from "../programs/target/idl/programs.json";
import dotenv from "dotenv";
dotenv.config();

const PROGRAM_ID = new PublicKey("6N6ckvYjUgGZCgwoE6XCQbsMuoxjUvoT3QYUt6LbfTbi");
const TXLINE_PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

async function main() {
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const wallet = anchor.Wallet.local();
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    anchor.setProvider(provider);
    const program = new anchor.Program(idl as anchor.Idl, provider) as any;

    const fixtureId = new BN(18179550);
    const statKey = 2;

    const [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), fixtureId.toArrayLike(Buffer, "le", 8), new BN(statKey).toArrayLike(Buffer, "le", 2)],
        PROGRAM_ID
    );

    // Fetch a fresh proof for this fixture/stat
    const client = axios.create({
        baseURL: "https://txline-dev.txodds.com",
        headers: {
            Authorization: `Bearer ${process.env.GUEST_JWT}`,
            "X-Api-Token": process.env.API_TOKEN,
        },
    });
    const v = (await client.get("/api/scores/stat-validation", {
        params: { fixtureId: 18179550, seq: 698, statKey },
    })).data;

    const fixtureSummary = {
        fixtureId: new BN(v.summary.fixtureId),
        updateStats: {
            updateCount: v.summary.updateStats.updateCount,
            minTimestamp: new BN(v.summary.updateStats.minTimestamp),
            maxTimestamp: new BN(v.summary.updateStats.maxTimestamp),
        },
        eventsSubTreeRoot: v.summary.eventStatsSubTreeRoot ?? v.summary.eventsSubTreeRoot,
    };

    const statA = {
        statToProve: v.statToProve,
        eventStatRoot: v.eventStatRoot,
        statProof: v.statProof,
    };

    const predicate = { threshold: 0, comparison: { greaterThan: {} } };
    const targetTs = v.summary.updateStats.minTimestamp;
    const epochDay = Math.floor(targetTs / (24 * 60 * 60 * 1000));

    const [dailyScoresPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("daily_scores_roots"), new BN(epochDay).toArrayLike(Buffer, "le", 2)],
        TXLINE_PROGRAM_ID
    );

    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });

    const tx = await program.methods
        .resolveMarket(true, new BN(targetTs), fixtureSummary, v.subTreeProof, v.mainTreeProof, predicate, statA, null, null)
        .accounts({
            market: marketPda,
            dailyScoresMerkleRoots: dailyScoresPda,
            authority: wallet.publicKey,
        })
        .preInstructions([computeBudgetIx])
        .rpc();

    console.log("Resolve tx:", tx);

    const marketAccount = await program.account.market.fetch(marketPda);
    console.log("Market after resolve:", marketAccount);
}

main().catch((err) => console.error(err));