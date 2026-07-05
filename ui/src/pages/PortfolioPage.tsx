// import React, { useState, useEffect, useCallback } from 'react';
// import { useWallet, useConnection } from '@solana/wallet-adapter-react';
// import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
// import { PublicKey } from '@solana/web3.js';
// import { getAssociatedTokenAddressSync } from '@solana/spl-token';
// import { BN } from '@coral-xyz/anchor';
// import { Link } from 'react-router-dom';
// import { motion } from 'framer-motion';
// import { WORLD_CUP_FIXTURES, PROGRAM_ID, COLLATERAL_MINT } from '../config';
// import './PortfolioPage.css';

// const PROGRAM_PK = new PublicKey(PROGRAM_ID);
// const COLLATERAL_MINT_PK = new PublicKey(COLLATERAL_MINT);

// const PortfolioPage: React.FC = () => {
//   const { publicKey, connected } = useWallet();
//   const { connection } = useConnection();
//   const [positions, setPositions] = useState<any[]>([]);
//   const [usdcBalance, setUsdcBalance] = useState(0);
//   const [solBalance, setSolBalance] = useState(0);
//   const [loading, setLoading] = useState(false);

//   const fetchPortfolio = useCallback(async () => {
//     if (!publicKey) return;
//     setLoading(true);
//     const pos: any[] = [];

//     const sol = await connection.getBalance(publicKey);
//     setSolBalance(sol / 1e9);

//     try {
//       const ua = getAssociatedTokenAddressSync(COLLATERAL_MINT_PK, publicKey);
//       const ub = await connection.getTokenAccountBalance(ua);
//       setUsdcBalance(Number(ub.value.uiAmount) || 0);
//     } catch { setUsdcBalance(0); }

//     for (const fixture of WORLD_CUP_FIXTURES) {
//       const fixBuf = new BN(fixture.id).toArrayLike(Buffer, 'le', 8);
//       const statBuf = new BN(fixture.statKey).toArrayLike(Buffer, 'le', 2);
//       const [market] = PublicKey.findProgramAddressSync([Buffer.from('market'), fixBuf, statBuf], PROGRAM_PK);
//       const [yesMint] = PublicKey.findProgramAddressSync([Buffer.from('yes_mint'), market.toBuffer()], PROGRAM_PK);
//       const [noMint] = PublicKey.findProgramAddressSync([Buffer.from('no_mint'), market.toBuffer()], PROGRAM_PK);

//       let yesBalance = 0, noBalance = 0, resolved = false, winningOutcome = 0;

//       try {
//         const info = await connection.getAccountInfo(market);
//         if (info && info.data.length >= 20) {
//           resolved = info.data[18] === 1;
//           winningOutcome = info.data[19];
//         }
//       } catch {}

//       try {
//         const ya = getAssociatedTokenAddressSync(yesMint, publicKey);
//         const yb = await connection.getTokenAccountBalance(ya);
//         yesBalance = Number(yb.value.uiAmount) || 0;
//       } catch {}

//       try {
//         const na = getAssociatedTokenAddressSync(noMint, publicKey);
//         const nb = await connection.getTokenAccountBalance(na);
//         noBalance = Number(nb.value.uiAmount) || 0;
//       } catch {}

//       if (yesBalance > 0 || noBalance > 0) {
//         pos.push({ fixture, yesBalance, noBalance, resolved, winningOutcome, market: market.toBase58() });
//       }
//     }

//     setPositions(pos);
//     setLoading(false);
//   }, [publicKey, connection]);

//   useEffect(() => { if (connected) fetchPortfolio(); }, [connected, fetchPortfolio]);

//   if (!connected) {
//     return (
//       <div className="portfolio-page">
//         <div className="pf-connect glass-card">
//           <div className="pf-connect-icon">🔐</div>
//           <h2>Connect Your Wallet</h2>
//           <p>Connect a Solana wallet to view your positions and balances</p>
//           <WalletMultiButton />
//         </div>
//       </div>
//     );
//   }

//   const totalValue = positions.reduce((s, p) => {
//     if (p.resolved) {
//       const winBal = p.winningOutcome === 1 ? p.yesBalance : p.noBalance;
//       return s + winBal;
//     }
//     return s + p.yesBalance * 0.5 + p.noBalance * 0.5;
//   }, 0);

//   return (
//     <div className="portfolio-page">
//       <div className="pf-header">
//         <h1 className="pf-title">Portfolio</h1>
//         <button className="btn btn-ghost btn-sm" onClick={fetchPortfolio}>↻ Refresh</button>
//       </div>

//       {/* Summary cards */}
//       <div className="pf-summary">
//         {[
//           { label: 'USDC Balance', value: `$${usdcBalance.toFixed(2)}`, sub: 'Dummy USDC (Devnet)', color: 'blue' },
//           { label: 'SOL Balance', value: `◎${solBalance.toFixed(4)}`, sub: 'For gas fees', color: 'purple' },
//           { label: 'Open Positions', value: String(positions.length), sub: 'Active markets', color: 'green' },
//           { label: 'Est. Position Value', value: `$${totalValue.toFixed(2)}`, sub: 'Mark-to-market', color: 'gold' },
//         ].map((c, i) => (
//           <motion.div key={c.label} initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:i*0.07}} className={`pf-stat-card glass-card pf-${c.color}`}>
//             <div className="pfsc-label">{c.label}</div>
//             <div className="pfsc-val">{c.value}</div>
//             <div className="pfsc-sub">{c.sub}</div>
//           </motion.div>
//         ))}
//       </div>

//       {/* Positions */}
//       <div className="pf-section">
//         <h2 className="pf-section-title">Open Positions</h2>
//         {loading ? (
//           <div className="pf-loading">Fetching positions from devnet...</div>
//         ) : positions.length === 0 ? (
//           <div className="pf-empty glass-card">
//             <div className="pf-empty-icon">📋</div>
//             <h3>No positions yet</h3>
//             <p>Head to the markets to place your first trade</p>
//             <Link to="/" className="btn btn-primary">Browse Markets</Link>
//           </div>
//         ) : (
//           <div className="pf-positions">
//             {positions.map((pos, i) => (
//               <motion.div key={pos.fixture.id} initial={{opacity:0,x:-16}} animate={{opacity:1,x:0}} transition={{delay:i*0.06}} className="pf-position glass-card">
//                 <div className="pfp-left">
//                   <div className="pfp-match">
//                     <span>{pos.fixture.homeLogo}{pos.fixture.awayLogo}</span>
//                     <span className="pfp-teams">{pos.fixture.homeCode} vs {pos.fixture.awayCode}</span>
//                     <span className={`tag ${pos.resolved ? 'tag-gray' : pos.fixture.status === 'live' ? 'tag-green' : 'tag-blue'}`}>
//                       {pos.resolved ? 'Resolved' : pos.fixture.status === 'live' ? 'Live' : 'Upcoming'}
//                     </span>
//                   </div>
//                   <div className="pfp-stat">{pos.fixture.statName} • {pos.fixture.venue}</div>
//                 </div>
//                 <div className="pfp-balances">
//                   {pos.yesBalance > 0 && (
//                     <div className="pfp-token yes">
//                       <span>YES</span>
//                       <span className="pfp-amount">{pos.yesBalance.toFixed(4)}</span>
//                       {pos.resolved && pos.winningOutcome === 1 && <span className="tag tag-green">Winner!</span>}
//                     </div>
//                   )}
//                   {pos.noBalance > 0 && (
//                     <div className="pfp-token no">
//                       <span>NO</span>
//                       <span className="pfp-amount">{pos.noBalance.toFixed(4)}</span>
//                       {pos.resolved && pos.winningOutcome === 2 && <span className="tag tag-green">Winner!</span>}
//                     </div>
//                   )}
//                 </div>
//                 <Link to={`/market/${pos.fixture.id}`} className="btn btn-secondary btn-sm">
//                   {pos.resolved ? 'Redeem →' : 'Trade →'}
//                 </Link>
//               </motion.div>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default PortfolioPage;


import React, { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { COLLATERAL_MINT } from '../config';
import type { MarketInfo } from '../hooks/useMarkets';
import './PortfolioPage.css';

const COLLATERAL_MINT_PK = new PublicKey(COLLATERAL_MINT);

interface Position {
  market: MarketInfo;
  yesBalance: number;
  noBalance: number;
}

interface PortfolioPageProps {
  markets: MarketInfo[];
}

const PortfolioPage: React.FC<PortfolioPageProps> = ({ markets }) => {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [positions, setPositions] = useState<Position[]>([]);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [solBalance, setSolBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchPortfolio = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    const pos: Position[] = [];

    const sol = await connection.getBalance(publicKey);
    setSolBalance(sol / 1e9);

    try {
      const ua = getAssociatedTokenAddressSync(COLLATERAL_MINT_PK, publicKey);
      const ub = await connection.getTokenAccountBalance(ua);
      setUsdcBalance(Number(ub.value.uiAmount) || 0);
    } catch { setUsdcBalance(0); }

    for (const market of markets) {
      if (!market.exists) continue;

      let yesBalance = 0, noBalance = 0;

      try {
        const ya = getAssociatedTokenAddressSync(new PublicKey(market.yesMintPda), publicKey);
        const yb = await connection.getTokenAccountBalance(ya);
        yesBalance = Number(yb.value.uiAmount) || 0;
      } catch { }

      try {
        const na = getAssociatedTokenAddressSync(new PublicKey(market.noMintPda), publicKey);
        const nb = await connection.getTokenAccountBalance(na);
        noBalance = Number(nb.value.uiAmount) || 0;
      } catch { }

      if (yesBalance > 0 || noBalance > 0) {
        pos.push({ market, yesBalance, noBalance });
      }
    }

    setPositions(pos);
    setLoading(false);
  }, [publicKey, connection, markets]);

  useEffect(() => { if (connected) fetchPortfolio(); }, [connected, fetchPortfolio]);

  if (!connected) {
    return (
      <div className="portfolio-page">
        <div className="pf-connect glass-card">
          <div className="pf-connect-icon">🔐</div>
          <h2>Connect Your Wallet</h2>
          <p>Connect a Solana wallet to view your positions and balances</p>
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  const totalValue = positions.reduce((s, p) => {
    if (p.market.resolved) {
      const winBal = p.market.winningOutcome === 1 ? p.yesBalance : p.noBalance;
      return s + winBal;
    }
    return s + p.yesBalance * 0.5 + p.noBalance * 0.5;
  }, 0);

  return (
    <div className="portfolio-page">
      <div className="pf-header">
        <h1 className="pf-title">Portfolio</h1>
        <button className="btn btn-ghost btn-sm" onClick={fetchPortfolio}>↻ Refresh</button>
      </div>

      <div className="pf-summary">
        {[
          { label: 'USDC Balance', value: `$${usdcBalance.toFixed(2)}`, sub: 'Dummy USDC (Devnet)', color: 'blue' },
          { label: 'SOL Balance', value: `◎${solBalance.toFixed(4)}`, sub: 'For gas fees', color: 'purple' },
          { label: 'Open Positions', value: String(positions.length), sub: 'Active markets', color: 'green' },
          { label: 'Est. Position Value', value: `$${totalValue.toFixed(2)}`, sub: 'Mark-to-market', color: 'gold' },
        ].map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className={`pf-stat-card glass-card pf-${c.color}`}>
            <div className="pfsc-label">{c.label}</div>
            <div className="pfsc-val">{c.value}</div>
            <div className="pfsc-sub">{c.sub}</div>
          </motion.div>
        ))}
      </div>

      <div className="pf-section">
        <h2 className="pf-section-title">Open Positions</h2>
        {loading ? (
          <div className="pf-loading">Fetching positions from devnet...</div>
        ) : positions.length === 0 ? (
          <div className="pf-empty glass-card">
            <div className="pf-empty-icon">📋</div>
            <h3>No positions yet</h3>
            <p>Head to the markets to place your first trade</p>
            <Link to="/" className="btn btn-primary">Browse Markets</Link>
          </div>
        ) : (
          <div className="pf-positions">
            {positions.map((pos, i) => (
              <motion.div key={pos.market.fixture.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="pf-position glass-card">
                <div className="pfp-left">
                  <div className="pfp-match">
                    <span>{pos.market.fixture.homeLogo}{pos.market.fixture.awayLogo}</span>
                    <span className="pfp-teams">{pos.market.fixture.homeCode} vs {pos.market.fixture.awayCode}</span>
                    <span className={`tag ${pos.market.resolved ? 'tag-gray' : pos.market.fixture.status === 'live' ? 'tag-green' : 'tag-blue'}`}>
                      {pos.market.resolved ? 'Resolved' : pos.market.fixture.status === 'live' ? 'Live' : 'Upcoming'}
                    </span>
                  </div>
                  <div className="pfp-stat">{pos.market.fixture.statName}</div>
                </div>
                <div className="pfp-balances">
                  {pos.yesBalance > 0 && (
                    <div className="pfp-token yes">
                      <span>YES</span>
                      <span className="pfp-amount">{pos.yesBalance.toFixed(4)}</span>
                      {pos.market.resolved && pos.market.winningOutcome === 1 && <span className="tag tag-green">Winner!</span>}
                    </div>
                  )}
                  {pos.noBalance > 0 && (
                    <div className="pfp-token no">
                      <span>NO</span>
                      <span className="pfp-amount">{pos.noBalance.toFixed(4)}</span>
                      {pos.market.resolved && pos.market.winningOutcome === 0 && <span className="tag tag-green">Winner!</span>}
                    </div>
                  )}
                </div>
                <Link to={`/market/${pos.market.fixture.id}`} className="btn btn-secondary btn-sm">
                  {pos.market.resolved ? 'Redeem →' : 'Trade →'}
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PortfolioPage;