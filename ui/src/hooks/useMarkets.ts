import { useState, useEffect, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { AccountLayout } from '@solana/spl-token';
import { PROGRAM_ID } from '../config';
import type { Fixture } from '../config';

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
  yesPrice: number;
  noPrice: number;
  yesReserveAmt: number;
  noReserveAmt: number;
  totalLiquidity: number;
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

function parseTokenBalance(data: Uint8Array): number {
  if (data.length !== 165) return 0;
  try {
    const decoded = AccountLayout.decode(data);
    return Number(decoded.amount) / 1_000_000;
  } catch {
    return 0;
  }
}

export function useMarkets(fixtures: Fixture[]) {
  const { connection } = useConnection();
  const [markets, setMarkets] = useState<MarketInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    const results: MarketInfo[] = [];

    try {
      const keys: PublicKey[] = [];
      for (const fixture of fixtures) {
        const pdas = deriveMarketPdas(fixture.id, fixture.statKey);
        keys.push(new PublicKey(pdas.marketPda));
        keys.push(new PublicKey(pdas.yesReservePda));
        keys.push(new PublicKey(pdas.noReservePda));
        keys.push(new PublicKey(pdas.vaultPda));
      }

      const infos = keys.length > 0 ? await connection.getMultipleAccountsInfo(keys) : [];

      for (let i = 0; i < fixtures.length; i++) {
        const fixture = fixtures[i];
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

        const marketInfo = infos[4 * i + 0];
        const yesReserveInfo = infos[4 * i + 1];
        const noReserveInfo = infos[4 * i + 2];
        const vaultInfo = infos[4 * i + 3];

        if (marketInfo && marketInfo.data.length >= 12) {
          exists = true;
          const data = marketInfo.data;
          resolved = data[18] === 1;
          winningOutcome = data[19];
        }

        if (exists) {
          if (yesReserveInfo) {
            yesReserveAmt = parseTokenBalance(yesReserveInfo.data);
          }
          if (noReserveInfo) {
            noReserveAmt = parseTokenBalance(noReserveInfo.data);
          }
          totalLiquidity = yesReserveAmt + noReserveAmt;

          if (totalLiquidity > 0) {
            yesPrice = noReserveAmt / totalLiquidity;
            noPrice = yesReserveAmt / totalLiquidity;
          }

          if (vaultInfo) {
            vaultBalance = parseTokenBalance(vaultInfo.data);
          }
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
    } catch (e) {
      console.error('Failed to fetch markets', e);
    }

    setMarkets(results);
    setLoading(false);
  }, [connection, fixtures]);

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 20000);
    return () => clearInterval(interval);
  }, [fetchMarkets]);

  return { markets, loading, refresh: fetchMarkets };
}