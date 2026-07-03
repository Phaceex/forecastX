import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import idl from "../programs/target/idl/programs.json"; // adjust path if your program name differs
import dotenv from "dotenv";
dotenv.config();

const PROGRAM_ID = new PublicKey("6N6ckvYjUgGZCgwoE6XCQbsMuoxjUvoT3QYUt6LbfTbi");

async function main() {
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const wallet = anchor.Wallet.local(); // reads ~/.config/solana/id.json
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    anchor.setProvider(provider);

    const program = new anchor.Program(idl as anchor.Idl, provider) as any;

    // Using the live fixture you already validated on-chain earlier
    const fixtureId = new BN(18179550);
    const statKey = 2; // Participant2 Total Goals

    const [marketPda] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("market"),
            fixtureId.toArrayLike(Buffer, "le", 8),
            new BN(statKey).toArrayLike(Buffer, "le", 2),
        ],
        PROGRAM_ID
    );

    console.log("Market PDA:", marketPda.toBase58());

    const tx = await program.methods
        .initializeMarket(fixtureId, statKey)
        .accounts({
            market: marketPda,
            authority: wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

    console.log("Transaction:", tx);

    const marketAccount = await (program.account as any).market.fetch(marketPda);
    console.log("Market account:", marketAccount);
}

main().catch((err) => console.error(err));