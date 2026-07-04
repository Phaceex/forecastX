import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, ComputeBudgetProgram, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import axios from "axios";
import idl from "../programs/target/idl/programs.json";
import dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const PROGRAM_ID = new PublicKey("6N6ckvYjUgGZCgwoE6XCQbsMuoxjUvoT3QYUt6LbfTbi");
const TXLINE_PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const COLLATERAL_MINT = new PublicKey(process.env.DUMMY_USDC_MINT || "y1NRCJLaggE1VGo3z3tzgut96U6UVmWLxytkjAN1aqT");

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

async function ensureAta(mint: PublicKey, owner: PublicKey, connection: Connection, wallet: anchor.Wallet): Promise<PublicKey> {
    const ata = getAssociatedTokenAddressSync(mint, owner);
    const info = await connection.getAccountInfo(ata);
    if (!info) {
        console.log(`[ATA] Creating ATA for mint ${mint.toBase58()}...`);
        const tx = new anchor.web3.Transaction().add(
            createAssociatedTokenAccountInstruction(
                wallet.publicKey, // payer
                ata,   // associatedTokenAddress
                owner, // owner
                mint   // mint
            )
        );
        const sig = await anchor.web3.sendAndConfirmTransaction(connection, tx, [wallet.payer]);
        console.log(`[ATA] ATA created. Signature: ${sig}`);
    }
    return ata;
}

async function getTokenBalance(ata: PublicKey, connection: Connection): Promise<BN> {
    try {
        const balanceInfo = await connection.getTokenAccountBalance(ata);
        return new BN(balanceInfo.value.amount);
    } catch {
        return new BN(0);
    }
}

async function main() {
    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
    console.log(`Connecting to RPC: ${rpcUrl}`);
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
    const program = new anchor.Program(idl as anchor.Idl, provider) as any;

    console.log(`\n--- WALLET DETAILS ---`);
    console.log(`Wallet Address: ${wallet.publicKey.toBase58()}`);
    const solBalance = await connection.getBalance(wallet.publicKey);
    console.log(`SOL Balance: ${solBalance / 1e9} SOL`);

    const userCollateralAta = await ensureAta(COLLATERAL_MINT, wallet.publicKey, connection, wallet);
    const initialUsdc = await getTokenBalance(userCollateralAta, connection);
    console.log(`Dummy USDC ATA: ${userCollateralAta.toBase58()}`);
    console.log(`USDC Balance: ${initialUsdc.toString()} micro-USDC`);

    // ==========================================
    // PHASE 1: AMM & Mint/Burn flow (random fixture)
    // ==========================================
    console.log(`\n==========================================`);
    console.log(`PHASE 1: AMM & Mint/Burn flow (Random Fixture ID)`);
    console.log(`==========================================`);

    const randomFixtureId = new BN(10000000 + Math.floor(Math.random() * 90000000));
    const statKey = 2;

    console.log(`Using random Fixture ID: ${randomFixtureId.toString()}`);

    const [marketPda] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("market"),
            randomFixtureId.toArrayLike(Buffer, "le", 8),
            new BN(statKey).toArrayLike(Buffer, "le", 2),
        ],
        PROGRAM_ID
    );
    console.log(`Market PDA: ${marketPda.toBase58()}`);

    const [yesMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("yes_mint"), marketPda.toBuffer()],
        PROGRAM_ID
    );
    const [noMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("no_mint"), marketPda.toBuffer()],
        PROGRAM_ID
    );
    const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), marketPda.toBuffer()],
        PROGRAM_ID
    );
    const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), marketPda.toBuffer()],
        PROGRAM_ID
    );
    const [lpMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("lp_mint"), marketPda.toBuffer()],
        PROGRAM_ID
    );
    const [yesReservePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("yes_reserve"), marketPda.toBuffer()],
        PROGRAM_ID
    );
    const [noReservePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("no_reserve"), marketPda.toBuffer()],
        PROGRAM_ID
    );

    console.log(`Derived Yes Mint: ${yesMintPda.toBase58()}`);
    console.log(`Derived No Mint: ${noMintPda.toBase58()}`);
    console.log(`Derived Vault PDA: ${vaultPda.toBase58()}`);
    console.log(`Derived Pool PDA: ${poolPda.toBase58()}`);
    console.log(`Derived LP Mint: ${lpMintPda.toBase58()}`);
    console.log(`Derived Yes Reserve: ${yesReservePda.toBase58()}`);
    console.log(`Derived No Reserve: ${noReservePda.toBase58()}`);

    // Step 1: Initialize Market
    console.log(`\n[Step 1] Initializing Market...`);
    const initMarketTx = await program.methods
        .initializeMarket(randomFixtureId, statKey)
        .accounts({
            market: marketPda,
            collateralMint: COLLATERAL_MINT,
            yesMint: yesMintPda,
            noMint: noMintPda,
            vault: vaultPda,
            authority: wallet.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
    console.log(`SUCCESS: Market initialized. Tx: ${initMarketTx}`);

    // Ensure YES & NO ATAs exist now that the mints have been initialized
    const userYesAta = await ensureAta(yesMintPda, wallet.publicKey, connection, wallet);
    const userNoAta = await ensureAta(noMintPda, wallet.publicKey, connection, wallet);

    const marketAcc = await program.account.market.fetch(marketPda);
    console.log("Market Account Info:", {
        fixtureId: marketAcc.fixtureId.toString(),
        statKey: marketAcc.statKey,
        resolved: marketAcc.resolved,
        winningOutcome: marketAcc.winningOutcome,
    });

    // Step 2: Mint Complete Set
    console.log(`\n[Step 2] Minting Complete Set...`);
    const mintAmount = new BN(100000); // 0.1 USDC
    const preMintUsdc = await getTokenBalance(userCollateralAta, connection);

    const mintTx = await program.methods
        .mintCompleteSet(mintAmount)
        .accounts({
            market: marketPda,
            collateralMint: COLLATERAL_MINT,
            yesMint: yesMintPda,
            noMint: noMintPda,
            vault: vaultPda,
            userCollateral: userCollateralAta,
            userYes: userYesAta,
            userNo: userNoAta,
            userAuthority: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
    console.log(`SUCCESS: Minted complete set. Tx: ${mintTx}`);

    const postMintUsdc = await getTokenBalance(userCollateralAta, connection);
    const postMintYes = await getTokenBalance(userYesAta, connection);
    const postMintNo = await getTokenBalance(userNoAta, connection);

    console.log(`Balances after Mint:`);
    console.log(`- USDC: ${postMintUsdc.toString()} (Diff: ${postMintUsdc.sub(preMintUsdc).toString()})`);
    console.log(`- YES:  ${postMintYes.toString()}`);
    console.log(`- NO:   ${postMintNo.toString()}`);

    if (!postMintYes.eq(mintAmount) || !postMintNo.eq(mintAmount)) {
        throw new Error("Mint complete set balance assertion failed");
    }

    // Step 3: Burn Complete Set
    console.log(`\n[Step 3] Burning Complete Set...`);
    const burnAmount = new BN(20000);

    const burnTx = await program.methods
        .burnCompleteSet(burnAmount)
        .accounts({
            market: marketPda,
            collateralMint: COLLATERAL_MINT,
            yesMint: yesMintPda,
            noMint: noMintPda,
            vault: vaultPda,
            userCollateral: userCollateralAta,
            userYes: userYesAta,
            userNo: userNoAta,
            userAuthority: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
    console.log(`SUCCESS: Burned complete set. Tx: ${burnTx}`);

    const postBurnUsdc = await getTokenBalance(userCollateralAta, connection);
    const postBurnYes = await getTokenBalance(userYesAta, connection);
    const postBurnNo = await getTokenBalance(userNoAta, connection);

    console.log(`Balances after Burn:`);
    console.log(`- USDC: ${postBurnUsdc.toString()} (Diff: ${postBurnUsdc.sub(postMintUsdc).toString()})`);
    console.log(`- YES:  ${postBurnYes.toString()}`);
    console.log(`- NO:   ${postBurnNo.toString()}`);

    if (!postBurnYes.eq(postMintYes.sub(burnAmount)) || !postBurnNo.eq(postMintNo.sub(burnAmount))) {
        throw new Error("Burn complete set balance assertion failed");
    }

    // Step 4: Init AMM Pool
    console.log(`\n[Step 4] Initializing AMM Pool...`);
    const poolInitialUsdc = new BN(50000); // 0.05 USDC

    // Derive user LP ATA (initPool will create it automatically on-chain)
    const userLpAta = getAssociatedTokenAddressSync(lpMintPda, wallet.publicKey);

    const initPoolTx = await program.methods
        .initPool(poolInitialUsdc)
        .accounts({
            market: marketPda,
            pool: poolPda,
            collateralMint: COLLATERAL_MINT,
            lpMint: lpMintPda,
            yesMint: yesMintPda,
            noMint: noMintPda,
            vault: vaultPda,
            yesReserve: yesReservePda,
            noReserve: noReservePda,
            userCollateral: userCollateralAta,
            userLp: userLpAta,
            authority: wallet.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
    console.log(`SUCCESS: AMM Pool initialized. Tx: ${initPoolTx}`);

    const poolAcc = await program.account.pool.fetch(poolPda);
    console.log("Pool State:", {
        market: poolAcc.market.toBase58(),
        lpMint: poolAcc.lpMint.toBase58(),
        yesReserve: poolAcc.yesReserve.toBase58(),
        noReserve: poolAcc.noReserve.toBase58(),
        k: poolAcc.k.toString(),
    });

    const lpBalance = await getTokenBalance(userLpAta, connection);
    console.log(`User LP Balance: ${lpBalance.toString()}`);
    if (!lpBalance.eq(poolInitialUsdc)) {
        throw new Error("Initial LP shares assertion failed");
    }

    // Step 5: Add Liquidity
    console.log(`\n[Step 5] Adding Liquidity to AMM Pool...`);
    const addLiquidityAmount = new BN(20000);

    const addLiqTx = await program.methods
        .addLiquidity(addLiquidityAmount)
        .accounts({
            market: marketPda,
            pool: poolPda,
            yesMint: yesMintPda,
            noMint: noMintPda,
            lpMint: lpMintPda,
            vault: vaultPda,
            yesReserve: yesReservePda,
            noReserve: noReservePda,
            userCollateral: userCollateralAta,
            userLp: userLpAta,
            authority: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
    console.log(`SUCCESS: Liquidity added. Tx: ${addLiqTx}`);

    const postAddLpBalance = await getTokenBalance(userLpAta, connection);
    console.log(`User LP Balance after adding liquidity: ${postAddLpBalance.toString()}`);
    if (!postAddLpBalance.eq(lpBalance.add(addLiquidityAmount))) {
        throw new Error("Add liquidity LP shares assertion failed");
    }

    // Step 6: Remove Liquidity
    console.log(`\n[Step 6] Removing Liquidity from AMM Pool...`);
    const removeLpAmount = new BN(15000);
    const preRemoveYes = await getTokenBalance(userYesAta, connection);
    const preRemoveNo = await getTokenBalance(userNoAta, connection);

    const removeLiqTx = await program.methods
        .removeLiquidity(removeLpAmount)
        .accounts({
            market: marketPda,
            pool: poolPda,
            lpMint: lpMintPda,
            yesReserve: yesReservePda,
            noReserve: noReservePda,
            userLp: userLpAta,
            userYes: userYesAta,
            userNo: userNoAta,
            authority: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
    console.log(`SUCCESS: Liquidity removed. Tx: ${removeLiqTx}`);

    const postRemoveLp = await getTokenBalance(userLpAta, connection);
    const postRemoveYes = await getTokenBalance(userYesAta, connection);
    const postRemoveNo = await getTokenBalance(userNoAta, connection);

    console.log(`Balances after removing liquidity:`);
    console.log(`- LP Balance: ${postRemoveLp.toString()}`);
    console.log(`- YES Diff:   ${postRemoveYes.sub(preRemoveYes).toString()}`);
    console.log(`- NO Diff:    ${postRemoveNo.sub(preRemoveNo).toString()}`);

    if (!postRemoveLp.eq(postAddLpBalance.sub(removeLpAmount))) {
        throw new Error("Remove liquidity LP shares assertion failed");
    }

    // Step 7: Swaps
    console.log(`\n[Step 7] Testing Swaps...`);

    // Swap type 0: USDC -> YES
    console.log("  [7a] Swap USDC -> YES");
    const swap0AmountIn = new BN(10000);
    const swap0MinOut = new BN(1000);
    const preSwap0Yes = await getTokenBalance(userYesAta, connection);

    const swap0Tx = await program.methods
        .swap(0, swap0AmountIn, swap0MinOut)
        .accounts({
            market: marketPda,
            pool: poolPda,
            yesMint: yesMintPda,
            noMint: noMintPda,
            vault: vaultPda,
            yesReserve: yesReservePda,
            noReserve: noReservePda,
            userCollateral: userCollateralAta,
            userYes: userYesAta,
            userNo: userNoAta,
            authority: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
    const postSwap0Yes = await getTokenBalance(userYesAta, connection);
    console.log(`  SUCCESS: Swapped USDC -> YES. YES Gained: ${postSwap0Yes.sub(preSwap0Yes).toString()}. Tx: ${swap0Tx}`);

    // Swap type 1: USDC -> NO
    console.log("  [7b] Swap USDC -> NO");
    const swap1AmountIn = new BN(10000);
    const swap1MinOut = new BN(1000);
    const preSwap1No = await getTokenBalance(userNoAta, connection);

    const swap1Tx = await program.methods
        .swap(1, swap1AmountIn, swap1MinOut)
        .accounts({
            market: marketPda,
            pool: poolPda,
            yesMint: yesMintPda,
            noMint: noMintPda,
            vault: vaultPda,
            yesReserve: yesReservePda,
            noReserve: noReservePda,
            userCollateral: userCollateralAta,
            userYes: userYesAta,
            userNo: userNoAta,
            authority: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
    const postSwap1No = await getTokenBalance(userNoAta, connection);
    console.log(`  SUCCESS: Swapped USDC -> NO. NO Gained: ${postSwap1No.sub(preSwap1No).toString()}. Tx: ${swap1Tx}`);

    // Swap type 2: YES -> USDC
    console.log("  [7c] Swap YES -> USDC");
    const swap2AmountIn = new BN(5000);
    const swap2MinOut = new BN(500);
    const preSwap2Usdc = await getTokenBalance(userCollateralAta, connection);

    const swap2Tx = await program.methods
        .swap(2, swap2AmountIn, swap2MinOut)
        .accounts({
            market: marketPda,
            pool: poolPda,
            yesMint: yesMintPda,
            noMint: noMintPda,
            vault: vaultPda,
            yesReserve: yesReservePda,
            noReserve: noReservePda,
            userCollateral: userCollateralAta,
            userYes: userYesAta,
            userNo: userNoAta,
            authority: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
    const postSwap2Usdc = await getTokenBalance(userCollateralAta, connection);
    console.log(`  SUCCESS: Swapped YES -> USDC. USDC Gained: ${postSwap2Usdc.sub(preSwap2Usdc).toString()}. Tx: ${swap2Tx}`);

    // Swap type 3: NO -> USDC
    console.log("  [7d] Swap NO -> USDC");
    const swap3AmountIn = new BN(5000);
    const swap3MinOut = new BN(500);
    const preSwap3Usdc = await getTokenBalance(userCollateralAta, connection);

    const swap3Tx = await program.methods
        .swap(3, swap3AmountIn, swap3MinOut)
        .accounts({
            market: marketPda,
            pool: poolPda,
            yesMint: yesMintPda,
            noMint: noMintPda,
            vault: vaultPda,
            yesReserve: yesReservePda,
            noReserve: noReservePda,
            userCollateral: userCollateralAta,
            userYes: userYesAta,
            userNo: userNoAta,
            authority: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
    const postSwap3Usdc = await getTokenBalance(userCollateralAta, connection);
    console.log(`  SUCCESS: Swapped NO -> USDC. USDC Gained: ${postSwap3Usdc.sub(preSwap3Usdc).toString()}. Tx: ${swap3Tx}`);

    // ==========================================
    // PHASE 2: Resolution & Redemption flow (Live fixture)
    // ==========================================
    console.log(`\n==========================================`);
    console.log(`PHASE 2: Resolution & Redemption flow (Live Fixture 18179550)`);
    console.log(`==========================================`);

    const liveFixtureId = new BN(18175918);
    const liveStatKey = 2;
    // const LIVE_FIXTURE_ID = 18175918;
    // const LIVE_STAT_KEY = 2; // keep as 2 — this is a fresh PDA since fixture ID is new
    // const LIVE_SEQ = 1238;

    const [liveMarketPda] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("market"),
            liveFixtureId.toArrayLike(Buffer, "le", 8),
            new BN(liveStatKey).toArrayLike(Buffer, "le", 2),
        ],
        PROGRAM_ID
    );
    console.log(`Live Market PDA: ${liveMarketPda.toBase58()}`);

    const [liveYesMint] = PublicKey.findProgramAddressSync(
        [Buffer.from("yes_mint"), liveMarketPda.toBuffer()],
        PROGRAM_ID
    );
    const [liveNoMint] = PublicKey.findProgramAddressSync(
        [Buffer.from("no_mint"), liveMarketPda.toBuffer()],
        PROGRAM_ID
    );
    const [liveVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), liveMarketPda.toBuffer()],
        PROGRAM_ID
    );

    // Check if live market exists
    let liveMarketExists = false;
    try {
        await program.account.market.fetch(liveMarketPda);
        liveMarketExists = true;
        console.log("Live Market PDA already exists.");
    } catch {
        console.log("Live Market PDA does not exist. Initializing it now...");
    }

    if (!liveMarketExists) {
        const initLiveMarketTx = await program.methods
            .initializeMarket(liveFixtureId, liveStatKey)
            .accounts({
                market: liveMarketPda,
                collateralMint: COLLATERAL_MINT,
                yesMint: liveYesMint,
                noMint: liveNoMint,
                vault: liveVault,
                authority: wallet.publicKey,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .rpc();
        console.log(`SUCCESS: Live market initialized. Tx: ${initLiveMarketTx}`);
    }

    // Ensure live YES & NO ATAs exist AFTER the market is initialized
    const liveUserYesAta = await ensureAta(liveYesMint, wallet.publicKey, connection, wallet);
    const liveUserNoAta = await ensureAta(liveNoMint, wallet.publicKey, connection, wallet);

    // Check if market is already resolved
    let liveMarketAcc = await program.account.market.fetch(liveMarketPda);
    if (liveMarketAcc.resolved) {
        console.log("WARNING: Live Market is already resolved. Skipping resolution validation.");
    } else {
        // Mint some complete sets first so there is collateral to claim
        console.log("\nMinting complete set on live market...");
        const liveMintAmount = new BN(30000);
        const liveMintTx = await program.methods
            .mintCompleteSet(liveMintAmount)
            .accounts({
                market: liveMarketPda,
                collateralMint: COLLATERAL_MINT,
                yesMint: liveYesMint,
                noMint: liveNoMint,
                vault: liveVault,
                userCollateral: userCollateralAta,
                userYes: liveUserYesAta,
                userNo: liveUserNoAta,
                userAuthority: wallet.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();
        console.log(`SUCCESS: Minted complete set on live market. Tx: ${liveMintTx}`);

        // Fetch proof from TxLINE Gateway
        console.log("\nFetching stat-validation proof from TxLINE Gateway...");
        const client = axios.create({
            baseURL: "https://txline-dev.txodds.com",
            headers: {
                Authorization: `Bearer ${process.env.GUEST_JWT}`,
                "X-Api-Token": process.env.API_TOKEN,
            },
        });
        const response = await client.get("/api/scores/stat-validation", {
            params: { fixtureId: 18175918, seq: 698, statKey: 2 },
        });
        const v = response.data;
        console.log("Proof fetched. Target timestamp:", v.summary.updateStats.minTimestamp);

        const fixtureSummary = {
            fixtureId: new BN(v.summary.fixtureId),
            updateStats: {
                updateCount: v.summary.updateStats.updateCount,
                minTimestamp: new BN(v.summary.updateStats.minTimestamp),
                maxTimestamp: new BN(v.summary.updateStats.maxTimestamp),
            },
            eventsSubTreeRoot: toBytes32(v.summary.eventStatsSubTreeRoot ?? v.summary.eventsSubTreeRoot),
        };

        const statA = {
            statToProve: {
                key: v.statToProve.key,
                value: v.statToProve.value,
                period: v.statToProve.period,
            },
            eventStatRoot: toBytes32(v.eventStatRoot),
            statProof: toProofNodes(v.statProof),
        };

        const predicate = { threshold: 0, comparison: { greaterThan: {} } };
        const targetTs = v.summary.updateStats.minTimestamp;
        const epochDay = Math.floor(targetTs / (24 * 60 * 60 * 1000));

        const [dailyScoresPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("daily_scores_roots"), new BN(epochDay).toArrayLike(Buffer, "le", 2)],
            TXLINE_PROGRAM_ID
        );
        console.log(`Derived dailyScoresPda: ${dailyScoresPda.toBase58()}`);

        const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1400000 });

        console.log("\nResolving Market via Oracle proof CPI...");
        const resolveTx = await program.methods
            .resolveMarket(
                true, // resolveYes = true (Participant2 Total Goals > 0)
                new BN(targetTs),
                fixtureSummary,
                toProofNodes(v.subTreeProof),
                toProofNodes(v.mainTreeProof),
                predicate,
                statA,
                null,
                null
            )
            .accounts({
                market: liveMarketPda,
                dailyScoresMerkleRoots: dailyScoresPda,
                txlineProgram: TXLINE_PROGRAM_ID,
                authority: wallet.publicKey,
            })
            .preInstructions([computeBudgetIx])
            .rpc();

        console.log(`SUCCESS: Live market resolved. Tx: ${resolveTx}`);
    }

    // Refresh live market account state
    liveMarketAcc = await program.account.market.fetch(liveMarketPda);
    console.log("\nResolved Live Market Info:", {
        resolved: liveMarketAcc.resolved,
        winningOutcome: liveMarketAcc.winningOutcome,
    });

    if (liveMarketAcc.winningOutcome !== 1) {
        throw new Error("Winning outcome is not YES (1) as expected");
    }

    // Step 8: Redeem winning tokens
    console.log(`\n[Step 8] Testing Redeem of Winning Tokens (YES)...`);
    const preRedeemUsdc = await getTokenBalance(userCollateralAta, connection);
    const preRedeemYes = await getTokenBalance(liveUserYesAta, connection);
    console.log(`Before Redeem:`);
    console.log(`- USDC balance: ${preRedeemUsdc.toString()}`);
    console.log(`- YES balance:  ${preRedeemYes.toString()}`);

    if (preRedeemYes.isZero()) {
        console.log("No winning YES tokens to redeem. Please ensure complete sets were minted before resolution.");
    } else {
        const redeemAmount = preRedeemYes; // redeem all of them
        console.log(`Redeeming ${redeemAmount.toString()} YES tokens...`);
        const redeemTx = await program.methods
            .redeem(redeemAmount)
            .accounts({
                market: liveMarketPda,
                yesMint: liveYesMint,
                noMint: liveNoMint,
                vault: liveVault,
                userWinningTokens: liveUserYesAta,
                userCollateral: userCollateralAta,
                authority: wallet.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        console.log(`SUCCESS: Redeemed tokens. Tx: ${redeemTx}`);

        const postRedeemUsdc = await getTokenBalance(userCollateralAta, connection);
        const postRedeemYes = await getTokenBalance(liveUserYesAta, connection);
        console.log(`After Redeem:`);
        console.log(`- USDC balance: ${postRedeemUsdc.toString()} (Diff: ${postRedeemUsdc.sub(preRedeemUsdc).toString()})`);
        console.log(`- YES balance:  ${postRedeemYes.toString()}`);

        if (!postRedeemYes.isZero() || !postRedeemUsdc.eq(preRedeemUsdc.add(redeemAmount))) {
            throw new Error("Redemption assertions failed");
        }
    }

    console.log(`\n==========================================`);
    console.log(`ALL TESTS COMPLETED SUCCESSFULLY!`);
    console.log(`==========================================\n`);
}

main().catch((err) => {
    console.error("Test execution failed with error:");
    console.error(err);
    process.exit(1);
});
