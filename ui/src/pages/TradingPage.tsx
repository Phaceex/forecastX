import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';
import { BN } from '@coral-xyz/anchor';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { PROGRAM_ID, COLLATERAL_MINT } from '../config';
import idl from '../idl/programs.json';
import './TradingPage.css';
import type { MarketInfo } from '../hooks/useMarkets';

const PROGRAM_PK = new PublicKey(PROGRAM_ID);
const COLLATERAL_MINT_PK = new PublicKey(COLLATERAL_MINT);

function deriveAll(fixtureId: number, statKey: number) {
  const fixBuf = new BN(fixtureId).toArrayLike(Buffer, 'le', 8);
  const statBuf = new BN(statKey).toArrayLike(Buffer, 'le', 2);
  const [market] = PublicKey.findProgramAddressSync([Buffer.from('market'), fixBuf, statBuf], PROGRAM_PK);
  const [yesMint] = PublicKey.findProgramAddressSync([Buffer.from('yes_mint'), market.toBuffer()], PROGRAM_PK);
  const [noMint] = PublicKey.findProgramAddressSync([Buffer.from('no_mint'), market.toBuffer()], PROGRAM_PK);
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from('vault'), market.toBuffer()], PROGRAM_PK);
  const [pool] = PublicKey.findProgramAddressSync([Buffer.from('pool'), market.toBuffer()], PROGRAM_PK);
  const [lpMint] = PublicKey.findProgramAddressSync([Buffer.from('lp_mint'), market.toBuffer()], PROGRAM_PK);
  const [yesReserve] = PublicKey.findProgramAddressSync([Buffer.from('yes_reserve'), market.toBuffer()], PROGRAM_PK);
  const [noReserve] = PublicKey.findProgramAddressSync([Buffer.from('no_reserve'), market.toBuffer()], PROGRAM_PK);
  return { market, yesMint, noMint, vault, pool, lpMint, yesReserve, noReserve };
}

interface PricePoint { t: string; yes: number; no: number; }
function genHistory(base: number): PricePoint[] {
  let y = base; const pts: PricePoint[] = [];
  for (let i = 90; i >= 0; i--) {
    y = Math.max(5, Math.min(95, y + (Math.random() - 0.5) * 2.5));
    const d = new Date(Date.now() - i * 60000);
    pts.push({ t: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`, yes: +y.toFixed(1), no: +(100 - y).toFixed(1) });
  }
  return pts;
}

interface TradingPageProps {
  markets: MarketInfo[];
}

const TradingPage: React.FC<TradingPageProps> = ({ markets }) => {
  const { fixtureId } = useParams<{ fixtureId: string }>();
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions, connected } = useWallet();

  const market = markets.find(m => m.fixture.id === Number(fixtureId));
  const fixture = market?.fixture;
  const pdas = fixture ? deriveAll(fixture.id, fixture.statKey) : null;
  const [tab, setTab] = useState<'buy-yes' | 'buy-no' | 'sell-yes' | 'sell-no'>('buy-yes');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(2);
  const [loading, setLoading] = useState(false);
  const [txMsg, setTxMsg] = useState('');
  const [txSig, setTxSig] = useState('');
  const [txErr, setTxErr] = useState('');
  // const [marketExists, setMarketExists] = useState(false);
  // const [marketResolved, setMarketResolved] = useState(false);
  // const [winningOutcome, setWinningOutcome] = useState(0);
  const [yesBalance, setYesBalance] = useState(0);
  const [noBalance, setNoBalance] = useState(0);
  const [usdcBalance, setUsdcBalance] = useState(0);
  // const [market?.yesPrice ?? 0.5, setmarket?.yesPrice ?? 0.5] = useState(0.5);
  // const [noPrice, setNoPrice] = useState(0.5);
  // const [liquidity, setLiquidity] = useState(0);
  const [chartData, setChartData] = useState<PricePoint[]>(() => genHistory(50));

  // Refresh chart
  useEffect(() => {
    const iv = setInterval(() => {
      setChartData(prev => {
        const last = prev[prev.length - 1];
        const ny = Math.max(5, Math.min(95, last.yes + (Math.random() - 0.5) * 2));
        const d = new Date();
        return [...prev.slice(-89), { t: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`, yes: +ny.toFixed(1), no: +(100 - ny).toFixed(1) }];
      });
    }, 2000);
    return () => clearInterval(iv);
  }, []);


  const refreshState = useCallback(async () => {
    if (!pdas || !publicKey) return;
    try {
      const ua = getAssociatedTokenAddressSync(COLLATERAL_MINT_PK, publicKey);
      const ub = await connection.getTokenAccountBalance(ua);
      setUsdcBalance(Number(ub.value.uiAmount) || 0);
    } catch { setUsdcBalance(0); }
    try {
      const ya = getAssociatedTokenAddressSync(pdas.yesMint, publicKey);
      const yb = await connection.getTokenAccountBalance(ya);
      setYesBalance(Number(yb.value.uiAmount) || 0);
    } catch { setYesBalance(0); }
    try {
      const na = getAssociatedTokenAddressSync(pdas.noMint, publicKey);
      const nb = await connection.getTokenAccountBalance(na);
      setNoBalance(Number(nb.value.uiAmount) || 0);
    } catch { setNoBalance(0); }
  }, [connection, pdas, publicKey]);

  useEffect(() => { refreshState(); const iv = setInterval(refreshState, 15000); return () => clearInterval(iv); }, [refreshState]);

  const getProgram = () => {
    if (!publicKey || !signTransaction || !signAllTransactions) return null;
    const wallet = { publicKey, signTransaction, signAllTransactions };
    const provider = new anchor.AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });
    return new anchor.Program(idl as anchor.Idl, provider) as any;
  };

  const handleInitMarket = async () => {
    if (!fixture || !pdas || !publicKey) return;
    setLoading(true); setTxErr(''); setTxMsg('Initializing market on-chain...');
    try {
      const program = getProgram();
      const sig = await program.methods.initializeMarket(new BN(fixture.id), fixture.statKey)
        .accounts({ market: pdas.market, collateralMint: COLLATERAL_MINT_PK, yesMint: pdas.yesMint, noMint: pdas.noMint, vault: pdas.vault, authority: publicKey, systemProgram: SystemProgram.programId, tokenProgram: TOKEN_PROGRAM_ID, rent: SYSVAR_RENT_PUBKEY })
        .rpc();
      setTxSig(sig); setTxMsg('✓ Market initialized!');
      await refreshState();
    } catch (e: any) { setTxErr(e?.message || String(e)); setTxMsg(''); }
    setLoading(false);
  };

  const handleTrade = async () => {
    if (!fixture || !pdas || !publicKey || !amount) return;
    setLoading(true); setTxErr(''); setTxMsg('Sending transaction...');
    try {
      const program = getProgram();
      const usdcAta = getAssociatedTokenAddressSync(COLLATERAL_MINT_PK, publicKey);
      const yesAta = getAssociatedTokenAddressSync(pdas.yesMint, publicKey);
      const noAta = getAssociatedTokenAddressSync(pdas.noMint, publicKey);
      const amtLamports = new BN(Math.round(Number(amount) * 1e6));
      const minOut = new BN(Math.round(Number(amount) * 1e6 * (1 - slippage / 100) * 0.8));
      const swapTypeMap = { 'buy-yes': 0, 'buy-no': 1, 'sell-yes': 2, 'sell-no': 3 };
      const swapType = swapTypeMap[tab];

      const sig = await program.methods.swap(swapType, amtLamports, minOut)
        .accounts({ market: pdas.market, pool: pdas.pool, yesMint: pdas.yesMint, noMint: pdas.noMint, vault: pdas.vault, yesReserve: pdas.yesReserve, noReserve: pdas.noReserve, userCollateral: usdcAta, userYes: yesAta, userNo: noAta, authority: publicKey, tokenProgram: TOKEN_PROGRAM_ID })
        .rpc();
      setTxSig(sig); setTxMsg(`✓ Swap confirmed!`);
      await refreshState();
      setAmount('');
    } catch (e: any) { setTxErr(e?.message || String(e)); setTxMsg(''); }
    setLoading(false);
  };

  const handleRedeem = async () => {
    if (!fixture || !pdas || !publicKey) return;
    setLoading(true); setTxErr(''); setTxMsg('Redeeming tokens...');
    try {
      const program = getProgram();
      const usdcAta = getAssociatedTokenAddressSync(COLLATERAL_MINT_PK, publicKey);
      const yesAta = getAssociatedTokenAddressSync(pdas.yesMint, publicKey);
      const noAta = getAssociatedTokenAddressSync(pdas.noMint, publicKey);
      const redeemBal = market?.winningOutcome ?? 0 ? yesBalance : noBalance;
      const redeemAta = market?.winningOutcome ?? 0 ? yesAta : noAta;
      const sig = await program.methods.redeem(new BN(Math.round(redeemBal * 1e6)))
        .accounts({ market: pdas.market, yesMint: pdas.yesMint, noMint: pdas.noMint, vault: pdas.vault, userWinningTokens: redeemAta, userCollateral: usdcAta, authority: publicKey, tokenProgram: TOKEN_PROGRAM_ID })
        .rpc();
      setTxSig(sig); setTxMsg('✓ Redeemed successfully!');
      await refreshState();
    } catch (e: any) { setTxErr(e?.message || String(e)); setTxMsg(''); }
    setLoading(false);
  };

  if (!fixture || !pdas) {
    return <div className="tp-error">Fixture not found. <Link to="/">← Back to Markets</Link></div>;
  }

  const yesPercent = (market?.yesPrice ?? 0.5 * 100).toFixed(1);
  const noPercent = (market?.noPrice ?? 0.5 * 100).toFixed(1);
  const estOutput = amount ? (Number(amount) * (tab.includes('yes') ? market?.yesPrice ?? 0.5 : market?.noPrice ?? 0.5) * (tab.startsWith('sell') ? 1 / market?.yesPrice : 1)).toFixed(4) : '—';

  return (
    <div className="trading-page">
      {/* Back */}
      <Link to="/" className="tp-back">← All Markets</Link>

      <div className="tp-layout">
        {/* Left: Market info + Chart */}
        <div className="tp-left">
          {/* Match header */}
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="tp-match-header glass-card">
            <div className="tpmh-teams">
              <div className="tpmh-team">
                <span className="tpmh-flag">{fixture.homeLogo}</span>
                <div>
                  <div className="tpmh-name">{fixture.homeTeam}</div>
                  <div className="tpmh-code">{fixture.homeCode}</div>
                </div>
              </div>
              <div className="tpmh-center">
                {fixture.status === 'live' ? (
                  <>
                    <div className="tpmh-score">{fixture.score.home} – {fixture.score.away}</div>
                    <div className="tpmh-live-badge"><span className="live-dot" />LIVE</div>
                  </>
                ) : fixture.status === 'resolved' ? (
                  <>
                    <div className="tpmh-score">{fixture.score.home} – {fixture.score.away}</div>
                    <div className="tag tag-gray">FINAL</div>
                  </>
                ) : (
                  <>
                    <div className="tpmh-vs">VS</div>
                    <div className="tpmh-kickoff">{new Date(fixture.kickoff).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  </>
                )}
              </div>
              <div className="tpmh-team tpmh-team-right">
                <div className="tpmh-team-text-right">
                  <div className="tpmh-name">{fixture.awayTeam}</div>
                  <div className="tpmh-code">{fixture.awayCode}</div>
                </div>
                <span className="tpmh-flag">{fixture.awayLogo}</span>
              </div>
            </div>
            <div className="tpmh-info">
              <span>📍 {fixture.venue}</span>
              <span>•</span>
              <span>Stat: <b>{fixture.statName}</b></span>
              <span>•</span>
              <span>Fixture ID: <b>{fixture.id}</b></span>
            </div>
          </motion.div>

          {/* Price cards */}
          <div className="tp-price-cards">
            <div className="tp-price-card yes">
              <div className="tppc-label">YES Price</div>
              <div className="tppc-val">{yesPercent}¢</div>
              <div className="tppc-sub">Implied probability</div>
            </div>
            <div className="tp-price-card stats">
              <div className="tppc-label">Liquidity</div>
              <div className="tppc-val">${market?.totalLiquidity ?? 0 > 0 ? market?.totalLiquidity.toFixed(2) : '—'}</div>
              <div className="tppc-sub">Total pool depth</div>
            </div>
            <div className="tp-price-card no">
              <div className="tppc-label">NO Price</div>
              <div className="tppc-val">{noPercent}¢</div>
              <div className="tppc-sub">Implied probability</div>
            </div>
          </div>

          {/* Chart */}
          <div className="tp-chart glass-card">
            <div className="tp-chart-header">
              <span className="tp-chart-title">Price History</span>
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <span style={{ color: '#22d3a0' }}>● YES</span>
                <span style={{ color: '#f87171' }}>● NO</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="yg2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3a0" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22d3a0" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ng2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f87171" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.08)" />
                <XAxis dataKey="t" tick={{ fill: '#4a7aaa', fontSize: 10 }} tickLine={false} axisLine={false} interval={14} />
                <YAxis domain={[0, 100]} tick={{ fill: '#4a7aaa', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}¢`} />
                <Tooltip contentStyle={{ background: 'rgba(4,15,30,0.97)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#94b4d4' }} />
                <Area type="monotone" dataKey="yes" stroke="#22d3a0" strokeWidth={2} fill="url(#yg2)" dot={false} isAnimationActive={false} name="YES" />
                <Area type="monotone" dataKey="no" stroke="#f87171" strokeWidth={2} fill="url(#ng2)" dot={false} isAnimationActive={false} name="NO" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Market status */}
          <div className="tp-market-status glass-card">
            <div className="tpms-row">
              <span className="tpms-label">On-Chain Status</span>
              <span className={`tag ${market?.exists ? (market?.resolved ? 'tag-gray' : 'tag-green') : 'tag-red'}`}>
                {market?.exists ? (market?.resolved ? 'Resolved' : 'Active') : 'Not Listed'}
              </span>
            </div>
            {market?.resolved && (
              <div className="tpms-row">
                <span className="tpms-label">Winner</span>
                <span className={`tag ${market?.winningOutcome === 1 ? 'tag-green' : 'tag-red'}`}>
                  {market?.winningOutcome === 1 ? 'YES wins' : 'NO wins'}
                </span>
              </div>
            )}
            <div className="tpms-row">
              <span className="tpms-label">Program</span>
              <a href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`} target="_blank" rel="noreferrer" className="tpms-link">
                {PROGRAM_ID.slice(0, 8)}…{PROGRAM_ID.slice(-6)} ↗
              </a>
            </div>
            <div className="tpms-row">
              <span className="tpms-label">Market PDA</span>
              <span className="tpms-addr">{pdas.market.toBase58().slice(0, 10)}…</span>
            </div>
          </div>
        </div>

        {/* Right: Trade panel */}
        <div className="tp-right">
          {/* Balances */}
          {connected && (
            <div className="tp-balances glass-card">
              <div className="tpb-title">Your Balances</div>
              <div className="tpb-items">
                <div className="tpb-item"><span>USDC</span><span className="tpb-val">{usdcBalance.toFixed(2)}</span></div>
                <div className="tpb-item"><span>YES</span><span className="tpb-val yes">{yesBalance.toFixed(4)}</span></div>
                <div className="tpb-item"><span>NO</span><span className="tpb-val no">{noBalance.toFixed(4)}</span></div>
              </div>
            </div>
          )}

          {/* Trade box */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="tp-trade-box glass-card">
            <div className="tp-trade-title">
              {!market?.exists ? 'List Market' : market?.resolved ? 'Redeem Winnings' : 'Place Order'}
            </div>

            {!connected ? (
              <div className="tp-connect-prompt">
                <p>Connect your wallet to trade</p>
                <WalletMultiButton />
              </div>
            ) : !market?.exists ? (
              <div className="tp-init">
                <p className="tp-init-desc">This market hasn't been listed on-chain yet. Be the first to initialize it and provide liquidity!</p>
                <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={handleInitMarket} disabled={loading}>
                  {loading ? <span className="spinner" /> : '🚀 Initialize Market'}
                </button>
              </div>
            ) : market?.resolved ? (
              <div className="tp-redeem">
                <div className={`tp-winner-banner ${market?.winningOutcome === 1 ? 'yes' : 'no'}`}>
                  {market?.winningOutcome === 1 ? '🎉 YES wins!' : '🎉 NO wins!'}
                  <span>Redeem your {market?.winningOutcome === 1 ? 'YES' : 'NO'} tokens for USDC</span>
                </div>
                <div className="tpb-item"><span>Redeemable tokens</span><span className="tpb-val">{market?.winningOutcome === 1 ? yesBalance.toFixed(4) : noBalance.toFixed(4)}</span></div>
                <button className="btn btn-success btn-lg" style={{ width: '100%', marginTop: 12 }} onClick={handleRedeem} disabled={loading || (market?.winningOutcome === 1 ? yesBalance === 0 : noBalance === 0)}>
                  {loading ? <span className="spinner" /> : '💰 Redeem Tokens'}
                </button>
              </div>
            ) : (
              <>
                {/* Swap tabs */}
                <div className="tp-swap-tabs">
                  {([['buy-yes', 'Buy YES'], ['buy-no', 'Buy NO'], ['sell-yes', 'Sell YES'], ['sell-no', 'Sell NO']] as const).map(([t, l]) => (
                    <button key={t} className={`tp-swap-tab ${t.includes('yes') ? 'yes-tab' : 'no-tab'} ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                      {l}
                    </button>
                  ))}
                </div>

                {/* Amount input */}
                <div className="tp-field">
                  <label className="tp-label">Amount ({tab.startsWith('buy') ? 'USDC' : tab.includes('yes') ? 'YES' : 'NO'})</label>
                  <div className="tp-input-wrap">
                    <input className="input tp-amount-input" type="number" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                    <button className="tp-max-btn" onClick={() => setAmount(tab.startsWith('buy') ? String(usdcBalance) : tab.includes('yes') ? String(yesBalance) : String(noBalance))}>MAX</button>
                  </div>
                </div>

                {/* Quick amounts */}
                <div className="tp-quick-amounts">
                  {['10', '25', '50', '100'].map(v => (
                    <button key={v} className="btn btn-ghost btn-sm" onClick={() => setAmount(v)}>${v}</button>
                  ))}
                </div>

                {/* Slippage */}
                <div className="tp-field">
                  <label className="tp-label">Slippage Tolerance</label>
                  <div className="tp-slippage-btns">
                    {[1, 2, 5].map(s => (
                      <button key={s} className={`btn btn-sm ${slippage === s ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setSlippage(s)}>{s}%</button>
                    ))}
                  </div>
                </div>

                {/* Est output */}
                {amount && (
                  <div className="tp-est-output">
                    <span>Estimated output</span>
                    <span className={tab.includes('yes') ? 'num-positive' : tab.includes('no') ? 'num-negative' : ''}>
                      ~{estOutput} {tab.startsWith('sell') ? 'USDC' : tab.includes('yes') ? 'YES' : 'NO'}
                    </span>
                  </div>
                )}

                <button
                  className={`btn btn-lg ${tab.includes('yes') ? 'btn-success' : 'btn-danger'}`}
                  style={{ width: '100%', marginTop: 8 }}
                  onClick={handleTrade}
                  disabled={loading || !amount || Number(amount) <= 0}
                >
                  {loading ? <span className="spinner" /> : `${tab === 'buy-yes' ? '🟢 Buy YES' : tab === 'buy-no' ? '🔴 Buy NO' : tab === 'sell-yes' ? '⬆ Sell YES' : '⬇ Sell NO'}`}
                </button>
              </>
            )}

            {/* TX messages */}
            {txMsg && <div className="tp-tx-success">{txMsg} {txSig && <a href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`} target="_blank" rel="noreferrer">View ↗</a>}</div>}
            {txErr && <div className="tp-tx-err">⚠ {txErr.slice(0, 120)}</div>}
          </motion.div>

          {/* Order book placeholder */}
          <div className="tp-orderbook glass-card">
            <div className="tpob-title">Order Book (AMM)</div>
            <div className="tpob-row header">
              <span>Price (¢)</span><span>Size</span><span>Total</span>
            </div>
            {[...Array(5)].map((_, i) => {
              const p = (market?.yesPrice * 100 + (i + 1) * 1.2).toFixed(1);
              const sz = (Math.random() * 200 + 50).toFixed(0);
              return (
                <div key={i} className="tpob-row sell">
                  <span>{p}</span><span>{sz}</span><span>{(Number(p) * Number(sz) / 100).toFixed(0)}</span>
                </div>
              );
            })}
            <div className="tpob-spread">
              <span>Spread</span>
              <span>{(Math.abs(market?.yesPrice - market?.noPrice) * 100).toFixed(2)}¢</span>
            </div>
            {[...Array(5)].map((_, i) => {
              const p = (market?.yesPrice ?? 0.5 * 100 - (i + 1) * 1.2).toFixed(1);
              const sz = (Math.random() * 200 + 50).toFixed(0);
              return (
                <div key={i} className="tpob-row buy">
                  <span>{p}</span><span>{sz}</span><span>{(Number(p) * Number(sz) / 100).toFixed(0)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradingPage;
