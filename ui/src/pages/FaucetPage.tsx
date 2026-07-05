import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { motion } from 'framer-motion';
import { COLLATERAL_MINT } from '../config';
import './FaucetPage.css';

const COLLATERAL_MINT_PK = new PublicKey(COLLATERAL_MINT);
// Mint authority is the test wallet from .env — for devnet faucet UI we show the ATA address
// and instruct the user to use CLI if they need more. The UI shows the key info.

const FaucetPage: React.FC = () => {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [ataAddress, setAtaAddress] = useState('');
  const [checking, setChecking] = useState(false);
  const [ataExists, setAtaExists] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);
  const [txSig, setTxSig] = useState('');
  const [err, setErr] = useState('');

  const checkATA = async () => {
    if (!publicKey) return;
    setChecking(true); setErr('');
    const ata = getAssociatedTokenAddressSync(COLLATERAL_MINT_PK, publicKey);
    setAtaAddress(ata.toBase58());
    try {
      const info = await connection.getAccountInfo(ata);
      setAtaExists(!!info);
    } catch { setAtaExists(false); }
    setChecking(false);
  };

  const createATA = async () => {
    if (!publicKey) return;
    setCreating(true); setErr(''); setTxSig('');
    try {
      const ata = getAssociatedTokenAddressSync(COLLATERAL_MINT_PK, publicKey);
      const ix = createAssociatedTokenAccountInstruction(publicKey, ata, publicKey, COLLATERAL_MINT_PK);
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, 'confirmed');
      setTxSig(sig); setAtaExists(true);
    } catch (e: any) { setErr(e?.message || String(e)); }
    setCreating(false);
  };

  const infoRows = [
    { label: 'Dummy USDC Mint', value: COLLATERAL_MINT, link: `https://explorer.solana.com/address/${COLLATERAL_MINT}?cluster=devnet` },
    { label: 'Network', value: 'Solana Devnet' },
    { label: 'Decimals', value: '6' },
    { label: 'Symbol', value: 'USDC (Test)' },
  ];

  return (
    <div className="faucet-page">
      <div className="faucet-hero glass-card">
        <motion.div initial={{opacity:0,y:-16}} animate={{opacity:1,y:0}} className="faucet-hero-content">
          <div className="faucet-icon">🚰</div>
          <h1 className="faucet-title">Test Token Faucet</h1>
          <p className="faucet-desc">
            ForecastX runs on Solana Devnet with a dummy USDC token for testing.
            Set up your token account below, then use the CLI to mint tokens.
          </p>
        </motion.div>
      </div>

      <div className="faucet-layout">
        {/* Setup panel */}
        <motion.div initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{delay:0.1}} className="glass-card faucet-card">
          <h2 className="faucet-card-title">1. Setup Token Account</h2>
          <p className="faucet-card-desc">Create your Associated Token Account (ATA) for the dummy USDC mint to receive test tokens.</p>

          {!connected ? (
            <div className="faucet-connect">
              <p>Connect your wallet first</p>
              <WalletMultiButton />
            </div>
          ) : (
            <div className="faucet-actions">
              <button className="btn btn-secondary" onClick={checkATA} disabled={checking}>
                {checking ? <span className="spinner"/> : '🔍 Check ATA Status'}
              </button>

              {ataAddress && (
                <div className="faucet-ata-info">
                  <div className="faucet-info-row">
                    <span className="faucet-info-label">Your ATA Address</span>
                    <span className="faucet-info-val mono">{ataAddress.slice(0,16)}…{ataAddress.slice(-8)}</span>
                  </div>
                  <div className="faucet-info-row">
                    <span className="faucet-info-label">Status</span>
                    <span className={`tag ${ataExists ? 'tag-green' : 'tag-red'}`}>
                      {ataExists ? '✓ Exists' : '✕ Not created'}
                    </span>
                  </div>
                  {!ataExists && (
                    <button className="btn btn-primary" onClick={createATA} disabled={creating} style={{marginTop:8}}>
                      {creating ? <span className="spinner"/> : '+ Create ATA'}
                    </button>
                  )}
                  {txSig && (
                    <a className="faucet-tx-link" href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`} target="_blank" rel="noreferrer">
                      ✓ ATA created — View TX ↗
                    </a>
                  )}
                </div>
              )}

              {err && <div className="faucet-err">⚠ {err.slice(0, 120)}</div>}
            </div>
          )}
        </motion.div>

        {/* Mint instructions */}
        <motion.div initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} transition={{delay:0.15}} className="glass-card faucet-card">
          <h2 className="faucet-card-title">2. Mint Test USDC</h2>
          <p className="faucet-card-desc">
            Use the Solana CLI with the mint authority wallet to send test USDC to your ATA.
            The mint authority is the project's devnet test wallet.
          </p>
          <div className="faucet-code-block">
            <div className="faucet-code-label">Mint 1,000 USDC to your ATA</div>
            <pre className="faucet-code">{`spl-token mint \\
  ${COLLATERAL_MINT} \\
  1000000 \\
  <YOUR_ATA_ADDRESS>`}</pre>
          </div>
          <div className="faucet-code-block">
            <div className="faucet-code-label">Check your balance</div>
            <pre className="faucet-code">{`spl-token accounts`}</pre>
          </div>
          <p className="faucet-note">
            💡 You need to be the mint authority (the project wallet) to mint. If you're a tester, ask the project team to send you tokens.
          </p>
        </motion.div>
      </div>

      {/* Token info */}
      <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.2}} className="glass-card faucet-info-card">
        <h2 className="faucet-card-title">Token Details</h2>
        <div className="faucet-info-grid">
          {infoRows.map(row => (
            <div key={row.label} className="faucet-info-row">
              <span className="faucet-info-label">{row.label}</span>
              {row.link ? (
                <a href={row.link} target="_blank" rel="noreferrer" className="faucet-info-link mono">
                  {row.value.slice(0,16)}…{row.value.slice(-8)} ↗
                </a>
              ) : (
                <span className="faucet-info-val">{row.value}</span>
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default FaucetPage;
