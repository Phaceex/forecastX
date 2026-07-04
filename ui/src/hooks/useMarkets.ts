import { useState, useEffect, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { PROGRAM_ID, WORLD_CUP_FIXTURES, Fixture } from '../config';

export interface MarketInfo {
  fixture: Fixture;
  marketPda: string;
  yesMintPda: string;
  noMintPda: string;
  vaultPda: string;
  poolPda: string;
  lpMintPda: string;
  yesReservePda: string;
  noReservePda: string;
  exists: boolean;
  resolved: boolean;
  winningOutcome: number;
  // AMM data
  yesPrice: number;
  noPrice: number;
  yesReserveAmt: number;
  noReserveAmt: number;
  totalLiquidity: number;
  // Derived from vault
  vaultBalance: number;
}

function deriveMarketPdas(fixtureId: number, statKey: number) {
  const programId = new PublicKey(PROGRAM_ID);
  const fixtureBuf = new BN(fixtureId).toArrayLike(Buffer, 'le', 8);
  const statBuf = new BN(statKey).toArrayLike(Buffer, 'le', 2);

  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('market'), fixtureBuf, statBuf],
    programId
  );
  const [yesMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('yes_mint'), marketPda.toBuffer()],
    programId
  );
  const [noMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('no_mint'), marketPda.toBuffer()],
    programId
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), marketPda.toBuffer()],
    programId
  );
  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), marketPda.toBuffer()],
    programId
  );
  const [lpMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('lp_mint'), marketPda.toBuffer()],
    programId
  );
  const [yesReservePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('yes_reserve'), marketPda.toBuffer()],
    programId
  );
  const [noReservePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('no_reserve'), marketPda.toBuffer()],
    programId
  );

  return {
    marketPda: marketPda.toBase58(),
    yesMintPda: yesMintPda.toBase58(),
    noMintPda: noMintPda.toBase58(),
    vaultPda: vaultPda.toBase58(),
    poolPda: poolPda.toBase58(),
    lpMintPda: lpMintPda.toBase58(),
    yesReservePda: yesReservePda.toBase58(),
    noReservePda: noReservePda.toBase58(),
  };
}

export function useMarkets() {
  const { connection } = useConnection();
  const [markets, setMarkets] = useState<MarketInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    const results: MarketInfo[] = [];

    for (const fixture of WORLD_CUP_FIXTURES) {
      const pdas = deriveMarketPdas(fixture.id, fixture.statKey);

      let exists = false;
      let resolved = false;
      let winningOutcome = 0;
      let yesPrice = 0.5;
      let noPrice = 0.5;
      let yesReserveAmt = 0;
      let noReserveAmt = 0;
      let totalLiquidity = 0;
      let vaultBalance = 0;

      try {
        const accountInfo = await connection.getAccountInfo(new PublicKey(pdas.marketPda));
        if (accountInfo && accountInfo.data.length >= 12) {
          exists = true;
          // Parse market account data (after 8-byte discriminator)
          // fixture_id: u64 (8 bytes), stat_key: u16 (2), resolved: bool (1), winning_outcome: u8 (1)
          const data = accountInfo.data;
          resolved = data[18] === 1;
          winningOutcome = data[19];
        }
      } catch { /* not created yet */ }

      if (exists) {
        try {
          const yesReserveInfo = await connection.getTokenAccountBalance(
            new PublicKey(pdas.yesReservePda)
          );
          const noReserveInfo = await connection.getTokenAccountBalance(
            new PublicKey(pdas.noReservePda)
          );
          yesReserveAmt = Number(yesReserveInfo.value.uiAmount) || 0;
          noReserveAmt = Number(noReserveInfo.value.uiAmount) || 0;
          totalLiquidity = yesReserveAmt + noReserveAmt;

          if (totalLiquidity > 0) {
            yesPrice = noReserveAmt / totalLiquidity;
            noPrice = yesReserveAmt / totalLiquidity;
          }

          const vaultInfo = await connection.getTokenAccountBalance(
            new PublicKey(pdas.vaultPda)
          );
          vaultBalance = Number(vaultInfo.value.uiAmount) || 0;
        } catch { /* pool not initialized */ }
      }

      results.push({
        fixture,
        ...pdas,
        exists,
        resolved,
        winningOutcome,
        yesPrice,
        noPrice,
        yesReserveAmt,
        noReserveAmt,
        totalLiquidity,
        vaultBalance,
      });
    }

    setMarkets(results);
    setLoading(false);
  }, [connection]);

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 20000);
    return () => clearInterval(interval);
  }, [fetchMarkets]);

  return { markets, loading, refresh: fetchMarkets };
}
