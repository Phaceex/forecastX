// import React, { useState } from 'react';
// import { useWallet, useConnection } from '@solana/wallet-adapter-react';
// import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
// import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
// import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
// import * as anchor from '@coral-xyz/anchor';
// import { BN } from '@coral-xyz/anchor';
// import { Link } from 'react-router-dom';
// import { motion } from 'framer-motion';
// import { WORLD_CUP_FIXTURES, PROGRAM_ID, COLLATERAL_MINT } from '../config';
// import idl from '../idl/programs.json';
// import './LiquidityPage.css';

// const PROGRAM_PK = new PublicKey(PROGRAM_ID);
// const COLLATERAL_MINT_PK = new PublicKey(COLLATERAL_MINT);

// function deriveAll(fixtureId: number, statKey: number) {
//   const fixBuf = new BN(fixtureId).toArrayLike(Buffer, 'le', 8);
//   const statBuf = new BN(statKey).toArrayLike(Buffer, 'le', 2);
//   const [market] = PublicKey.findProgramAddressSync([Buffer.from('market'), fixBuf, statBuf], PROGRAM_PK);
//   const [yesMint] = PublicKey.findProgramAddressSync([Buffer.from('yes_mint'), market.toBuffer()], PROGRAM_PK);
//   const [noMint] = PublicKey.findProgramAddressSync([Buffer.from('no_mint'), market.toBuffer()], PROGRAM_PK);
//   const [vault] = PublicKey.findProgramAddressSync([Buffer.from('vault'), market.toBuffer()], PROGRAM_PK);
//   const [pool] = PublicKey.findProgramAddressSync([Buffer.from('pool'), market.toBuffer()], PROGRAM_PK);
//   const [lpMint] = PublicKey.findProgramAddressSync([Buffer.from('lp_mint'), market.toBuffer()], PROGRAM_PK);
//   const [yesReserve] = PublicKey.findProgramAddressSync([Buffer.from('yes_reserve'), market.toBuffer()], PROGRAM_PK);
//   const [noReserve] = PublicKey.findProgramAddressSync([Buffer.from('no_reserve'), market.toBuffer()], PROGRAM_PK);
//   return { market, yesMint, noMint, vault, pool, lpMint, yesReserve, noReserve };
// }

// const LiquidityPage: React.FC = () => {
//   const { publicKey, signTransaction, signAllTransactions, connected } = useWallet();
//   const { connection } = useConnection();
//   const [selectedFixture, setSelectedFixture] = useState(WORLD_CUP_FIXTURES[0]);
//   const [liqAction, setLiqAction] = useState<'init' | 'add' | 'remove'>('init');
//   const [amount, setAmount] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [msg, setMsg] = useState('');
//   const [txSig, setTxSig] = useState('');
//   const [err, setErr] = useState('');

//   const getProgram = () => {
//     if (!publicKey || !signTransaction || !signAllTransactions) return null;
//     const wallet = { publicKey, signTransaction, signAllTransactions };
//     const provider = new anchor.AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });
//     return new anchor.Program(idl as anchor.Idl, provider) as any;
//   };

//   const handleSubmit = async () => {
//     if (!publicKey || !amount) return;
//     setLoading(true); setErr(''); setMsg('Sending transaction...'); setTxSig('');
//     try {
//       const program = getProgram();
//       const pdas = deriveAll(selectedFixture.id, selectedFixture.statKey);
//       const amtBN = new BN(Math.round(Number(amount) * 1e6));
//       const usdcAta = getAssociatedTokenAddressSync(COLLATERAL_MINT_PK, publicKey);
//       const lpAta = getAssociatedTokenAddressSync(pdas.lpMint, publicKey);
//       const yesAta = getAssociatedTokenAddressSync(pdas.yesMint, publicKey);
//       const noAta = getAssociatedTokenAddressSync(pdas.noMint, publicKey);

//       let sig: string;
//       if (liqAction === 'init') {
//         sig = await program.methods.initPool(amtBN).accounts({
//           market: pdas.market, pool: pdas.pool, collateralMint: COLLATERAL_MINT_PK,
//           lpMint: pdas.lpMint, yesMint: pdas.yesMint, noMint: pdas.noMint,
//           vault: pdas.vault, yesReserve: pdas.yesReserve, noReserve: pdas.noReserve,
//           userCollateral: usdcAta, userLp: lpAta, authority: publicKey,
//           systemProgram: SystemProgram.programId, tokenProgram: TOKEN_PROGRAM_ID,
//           associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, rent: SYSVAR_RENT_PUBKEY,
//         }).rpc();
//       } else if (liqAction === 'add') {
//         sig = await program.methods.addLiquidity(amtBN).accounts({
//           market: pdas.market, pool: pdas.pool, yesMint: pdas.yesMint, noMint: pdas.noMint,
//           lpMint: pdas.lpMint, vault: pdas.vault, yesReserve: pdas.yesReserve, noReserve: pdas.noReserve,
//           userCollateral: usdcAta, userLp: lpAta, authority: publicKey, tokenProgram: TOKEN_PROGRAM_ID,
//         }).rpc();
//       } else {
//         sig = await program.methods.removeLiquidity(amtBN).accounts({
//           market: pdas.market, pool: pdas.pool, lpMint: pdas.lpMint,
//           yesReserve: pdas.yesReserve, noReserve: pdas.noReserve,
//           userLp: lpAta, userYes: yesAta, userNo: noAta, authority: publicKey, tokenProgram: TOKEN_PROGRAM_ID,
//         }).rpc();
//       }
//       setTxSig(sig); setMsg(`✓ ${liqAction === 'init' ? 'Pool initialized' : liqAction === 'add' ? 'Liquidity added' : 'Liquidity removed'}!`);
//       setAmount('');
//     } catch (e: any) { setErr(e?.message || String(e)); setMsg(''); }
//     setLoading(false);
//   };

//   return (
//     <div className="liquidity-page">
//       <div className="lp-header">
//         <h1 className="lp-title">Liquidity Pools</h1>
//         <p className="lp-sub">Provide liquidity to prediction markets and earn trading fees</p>
//       </div>

//       <div className="lp-layout">
//         {/* Pool list */}
//         <div className="lp-pools">
//           {WORLD_CUP_FIXTURES.map((f, i) => (
//             <motion.div
//               key={f.id}
//               initial={{opacity:0,x:-16}} animate={{opacity:1,x:0}} transition={{delay:i*0.05}}
//               className={`lp-pool-row glass-card ${selectedFixture.id === f.id ? 'lp-pool-selected' : ''}`}
//               onClick={() => setSelectedFixture(f)}
//             >
//               <div className="lppr-teams">
//                 <span className="lppr-flags">{f.homeLogo}{f.awayLogo}</span>
//                 <div>
//                   <div className="lppr-name">{f.homeCode} vs {f.awayCode}</div>
//                   <div className="lppr-sub">{f.group} • {f.statName}</div>
//                 </div>
//               </div>
//               <div className="lppr-right">
//                 <span className={`tag ${f.status === 'live' ? 'tag-green' : f.status === 'resolved' ? 'tag-gray' : 'tag-blue'}`}>
//                   {f.status}
//                 </span>
//                 <span className="lppr-apy">~12% APY</span>
//               </div>
//             </motion.div>
//           ))}
//         </div>

//         {/* Action panel */}
//         <motion.div initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} transition={{delay:0.1}} className="lp-action-panel glass-card">
//           <div className="lp-selected-match">
//             <span style={{fontSize:28}}>{selectedFixture.homeLogo}{selectedFixture.awayLogo}</span>
//             <div>
//               <div className="lp-match-name">{selectedFixture.homeCode} vs {selectedFixture.awayCode}</div>
//               <div className="lp-match-sub">{selectedFixture.venue}</div>
//             </div>
//           </div>

//           <div className="tabs lp-tabs">
//             {(['init','add','remove'] as const).map(a => (
//               <button key={a} className={`tab ${liqAction===a?'active':''}`} onClick={() => setLiqAction(a)}>
//                 {a === 'init' ? 'Init Pool' : a === 'add' ? 'Add' : 'Remove'}
//               </button>
//             ))}
//           </div>

//           <div className="lp-desc">
//             {liqAction === 'init' && 'Initialize a new AMM liquidity pool for this market. You must have minted YES/NO tokens first.'}
//             {liqAction === 'add' && 'Add USDC liquidity to the pool. You receive LP tokens representing your share.'}
//             {liqAction === 'remove' && 'Burn LP tokens to withdraw your share of YES and NO tokens from the pool.'}
//           </div>

//           {!connected ? (
//             <div className="lp-connect">
//               <p>Connect wallet to manage liquidity</p>
//               <WalletMultiButton />
//             </div>
//           ) : (
//             <>
//               <div className="tp-field">
//                 <label className="tp-label">
//                   {liqAction === 'remove' ? 'LP Tokens to burn' : 'USDC Amount'}
//                 </label>
//                 <div className="tp-input-wrap">
//                   <input className="input tp-amount-input" type="number" min="0" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)} />
//                 </div>
//               </div>
//               <div className="tp-quick-amounts">
//                 {['10','50','100','500'].map(v=>(
//                   <button key={v} className="btn btn-ghost btn-sm" onClick={()=>setAmount(v)}>${v}</button>
//                 ))}
//               </div>
//               <button className="btn btn-primary btn-lg" style={{width:'100%'}} onClick={handleSubmit} disabled={loading||!amount}>
//                 {loading ? <span className="spinner"/> :
//                   liqAction==='init' ? '🚀 Initialize Pool' :
//                   liqAction==='add' ? '+ Add Liquidity' : '- Remove Liquidity'}
//               </button>
//               {msg && <div className="tp-tx-success">{msg} {txSig && <a href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`} target="_blank" rel="noreferrer">View ↗</a>}</div>}
//               {err && <div className="tp-tx-err">⚠ {err.slice(0,120)}</div>}
//             </>
//           )}

//           {/* Info */}
//           <div className="lp-info-rows">
//             {[
//               { label: 'Pool Mechanism', value: 'Constant Product AMM (x·y=k)' },
//               { label: 'Trading Fee', value: '0%' },
//               { label: 'Market ID', value: String(selectedFixture.id) },
//             ].map(row => (
//               <div key={row.label} className="lp-info-row">
//                 <span className="lp-info-label">{row.label}</span>
//                 <span className="lp-info-val">{row.value}</span>
//               </div>
//             ))}
//           </div>
//         </motion.div>
//       </div>
//     </div>
//   );
// };

// export default LiquidityPage;

import React, { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';
import { BN } from '@coral-xyz/anchor';
import { motion } from 'framer-motion';
import { COLLATERAL_MINT } from '../config';
import type { MarketInfo } from '../hooks/useMarkets';
import idl from '../idl/programs.json';
import './LiquidityPage.css';

const COLLATERAL_MINT_PK = new PublicKey(COLLATERAL_MINT);

interface LiquidityPageProps {
  markets: MarketInfo[];
}

const LiquidityPage: React.FC<LiquidityPageProps> = ({ markets }) => {
  const { publicKey, signTransaction, signAllTransactions, connected } = useWallet();
  const { connection } = useConnection();
  const [selectedMarket, setSelectedMarket] = useState<MarketInfo | null>(markets[0] ?? null);
  const [liqAction, setLiqAction] = useState<'init' | 'add' | 'remove'>('init');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [txSig, setTxSig] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!selectedMarket && markets.length > 0) setSelectedMarket(markets[0]);
  }, [markets, selectedMarket]);

  const getProgram = () => {
    if (!publicKey || !signTransaction || !signAllTransactions) return null;
    const wallet = { publicKey, signTransaction, signAllTransactions };
    const provider = new anchor.AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });
    return new anchor.Program(idl as anchor.Idl, provider) as any;
  };

  const handleSubmit = async () => {
    if (!publicKey || !amount || !selectedMarket) return;
    setLoading(true); setErr(''); setMsg('Checking token accounts...'); setTxSig('');
    try {
      const program = getProgram();
      if (!program) throw new Error("Wallet not connected or program not initialized");
      const market = new PublicKey(selectedMarket.marketPda);
      const pool = new PublicKey(selectedMarket.poolPda);
      const lpMint = new PublicKey(selectedMarket.lpMintPda);
      const yesMint = new PublicKey(selectedMarket.yesMintPda);
      const noMint = new PublicKey(selectedMarket.noMintPda);
      const vault = new PublicKey(selectedMarket.vaultPda);
      const yesReserve = new PublicKey(selectedMarket.yesReservePda);
      const noReserve = new PublicKey(selectedMarket.noReservePda);

      const amtBN = new BN(Math.round(Number(amount) * 1e6));
      const usdcAta = getAssociatedTokenAddressSync(COLLATERAL_MINT_PK, publicKey);
      const lpAta = getAssociatedTokenAddressSync(lpMint, publicKey);
      const yesAta = getAssociatedTokenAddressSync(yesMint, publicKey);
      const noAta = getAssociatedTokenAddressSync(noMint, publicKey);

      const preIxs = [];

      // Check usdcAta (needed for init and add)
      if (liqAction === 'init' || liqAction === 'add') {
        const usdcInfo = await connection.getAccountInfo(usdcAta);
        if (!usdcInfo) {
          setMsg('Preparing USDC token account...');
          preIxs.push(
            createAssociatedTokenAccountInstruction(
              publicKey,
              usdcAta,
              publicKey,
              COLLATERAL_MINT_PK
            )
          );
        }
      }

      // Check lpAta (needed for add)
      if (liqAction === 'add') {
        const lpInfo = await connection.getAccountInfo(lpAta);
        if (!lpInfo) {
          setMsg('Preparing LP token account...');
          preIxs.push(
            createAssociatedTokenAccountInstruction(
              publicKey,
              lpAta,
              publicKey,
              lpMint
            )
          );
        }
      }

      // Check yesAta and noAta (needed for remove)
      if (liqAction === 'remove') {
        const yesInfo = await connection.getAccountInfo(yesAta);
        if (!yesInfo) {
          setMsg('Preparing YES token account...');
          preIxs.push(
            createAssociatedTokenAccountInstruction(
              publicKey,
              yesAta,
              publicKey,
              yesMint
            )
          );
        }
        const noInfo = await connection.getAccountInfo(noAta);
        if (!noInfo) {
          setMsg('Preparing NO token account...');
          preIxs.push(
            createAssociatedTokenAccountInstruction(
              publicKey,
              noAta,
              publicKey,
              noMint
            )
          );
        }
      }

      setMsg('Sending transaction...');
      let sig: string;
      if (liqAction === 'init') {
        let builder = program.methods.initPool(amtBN).accounts({
          market, pool, collateralMint: COLLATERAL_MINT_PK,
          lpMint, yesMint, noMint,
          vault, yesReserve, noReserve,
          userCollateral: usdcAta, userLp: lpAta, authority: publicKey,
          systemProgram: SystemProgram.programId, tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, rent: SYSVAR_RENT_PUBKEY,
        });
        if (preIxs.length > 0) {
          builder = builder.preInstructions(preIxs);
        }
        sig = await builder.rpc();
      } else if (liqAction === 'add') {
        let builder = program.methods.addLiquidity(amtBN).accounts({
          market, pool, yesMint, noMint,
          lpMint, vault, yesReserve, noReserve,
          userCollateral: usdcAta, userLp: lpAta, authority: publicKey, tokenProgram: TOKEN_PROGRAM_ID,
        });
        if (preIxs.length > 0) {
          builder = builder.preInstructions(preIxs);
        }
        sig = await builder.rpc();
      } else {
        let builder = program.methods.removeLiquidity(amtBN).accounts({
          market, pool, lpMint,
          yesReserve, noReserve,
          userLp: lpAta, userYes: yesAta, userNo: noAta, authority: publicKey, tokenProgram: TOKEN_PROGRAM_ID,
        });
        if (preIxs.length > 0) {
          builder = builder.preInstructions(preIxs);
        }
        sig = await builder.rpc();
      }
      setTxSig(sig); setMsg(`✓ ${liqAction === 'init' ? 'Pool initialized' : liqAction === 'add' ? 'Liquidity added' : 'Liquidity removed'}!`);
      setAmount('');
    } catch (e: any) { setErr(e?.message || String(e)); setMsg(''); }
    setLoading(false);
  };

  if (!selectedMarket) {
    return (
      <div className="liquidity-page">
        <div className="lp-header">
          <h1 className="lp-title">Liquidity Pools</h1>
          <p className="lp-sub">Loading markets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="liquidity-page">
      <div className="lp-header">
        <h1 className="lp-title">Liquidity Pools</h1>
        <p className="lp-sub">Provide liquidity to prediction markets and earn trading fees</p>
      </div>

      <div className="lp-layout">
        <div className="lp-pools">
          {markets.map((m, i) => (
            <motion.div
              key={m.fixture.id}
              initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className={`lp-pool-row glass-card ${selectedMarket.fixture.id === m.fixture.id ? 'lp-pool-selected' : ''}`}
              onClick={() => setSelectedMarket(m)}
            >
              <div className="lppr-teams">
                <span className="lppr-flags">{m.fixture.homeLogo}{m.fixture.awayLogo}</span>
                <div>
                  <div className="lppr-name">{m.fixture.homeCode} vs {m.fixture.awayCode}</div>
                  <div className="lppr-sub">{m.fixture.statName}</div>
                </div>
              </div>
              <div className="lppr-right">
                <span className={`tag ${m.fixture.status === 'live' ? 'tag-green' : m.fixture.status === 'resolved' ? 'tag-gray' : 'tag-blue'}`}>
                  {m.fixture.status}
                </span>
                <span className="lppr-apy">~12% APY</span>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="lp-action-panel glass-card">
          <div className="lp-selected-match">
            <span style={{ fontSize: 28 }}>{selectedMarket.fixture.homeLogo}{selectedMarket.fixture.awayLogo}</span>
            <div>
              <div className="lp-match-name">{selectedMarket.fixture.homeCode} vs {selectedMarket.fixture.awayCode}</div>
              <div className="lp-match-sub">{selectedMarket.fixture.statName}</div>
            </div>
          </div>

          <div className="tabs lp-tabs">
            {(['init', 'add', 'remove'] as const).map(a => (
              <button key={a} className={`tab ${liqAction === a ? 'active' : ''}`} onClick={() => setLiqAction(a)}>
                {a === 'init' ? 'Init Pool' : a === 'add' ? 'Add' : 'Remove'}
              </button>
            ))}
          </div>

          <div className="lp-desc">
            {liqAction === 'init' && 'Initialize a new AMM liquidity pool for this market. You must have minted YES/NO tokens first.'}
            {liqAction === 'add' && 'Add USDC liquidity to the pool. You receive LP tokens representing your share.'}
            {liqAction === 'remove' && 'Burn LP tokens to withdraw your share of YES and NO tokens from the pool.'}
          </div>

          {!connected ? (
            <div className="lp-connect">
              <p>Connect wallet to manage liquidity</p>
              <WalletMultiButton />
            </div>
          ) : (
            <>
              <div className="tp-field">
                <label className="tp-label">
                  {liqAction === 'remove' ? 'LP Tokens to burn' : 'USDC Amount'}
                </label>
                <div className="tp-input-wrap">
                  <input className="input tp-amount-input" type="number" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
              </div>
              <div className="tp-quick-amounts">
                {['10', '50', '100', '500'].map(v => (
                  <button key={v} className="btn btn-ghost btn-sm" onClick={() => setAmount(v)}>${v}</button>
                ))}
              </div>
              <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={handleSubmit} disabled={loading || !amount}>
                {loading ? <span className="spinner" /> :
                  liqAction === 'init' ? '🚀 Initialize Pool' :
                    liqAction === 'add' ? '+ Add Liquidity' : '- Remove Liquidity'}
              </button>
              {msg && <div className="tp-tx-success">{msg} {txSig && <a href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`} target="_blank" rel="noreferrer">View ↗</a>}</div>}
              {err && <div className="tp-tx-err">⚠ {err.slice(0, 120)}</div>}
            </>
          )}

          <div className="lp-info-rows">
            {[
              { label: 'Pool Mechanism', value: 'Constant Product AMM (x·y=k)' },
              { label: 'Trading Fee', value: '0%' },
              { label: 'Market ID', value: String(selectedMarket.fixture.id) },
            ].map(row => (
              <div key={row.label} className="lp-info-row">
                <span className="lp-info-label">{row.label}</span>
                <span className="lp-info-val">{row.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LiquidityPage;