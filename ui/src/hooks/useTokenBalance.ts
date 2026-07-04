import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { COLLATERAL_MINT } from '../config';

export function useTokenBalance() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setUsdcBalance(null);
      setSolBalance(null);
      return;
    }
    setLoading(true);
    try {
      const sol = await connection.getBalance(publicKey);
      setSolBalance(sol / 1e9);

      const mint = new PublicKey(COLLATERAL_MINT);
      const ata = getAssociatedTokenAddressSync(mint, publicKey);
      try {
        const info = await connection.getTokenAccountBalance(ata);
        setUsdcBalance(Number(info.value.uiAmount));
      } catch {
        setUsdcBalance(0);
      }
    } catch (e) {
      console.error('Balance fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { usdcBalance, solBalance, loading, refresh };
}
