// import React, { useState } from 'react';
// import { motion } from 'framer-motion';
// import { useMarkets } from '../hooks/useMarkets';
// import MarketCard from '../components/MarketCard';
// import { useFixtures } from '../hooks/useFixtures';
// import { useLiveScores } from '../hooks/useLiveScores';
// import './MarketsPage.css';

// const FILTERS = ['All', 'Live', 'Upcoming', 'Resolved'];
// const [jwt, setJwt] = useState<string | null>(null);
// const [apiToken, setApiToken] = useState<string | null>(null);

// const MarketsPage: React.FC = () => {
//   const { fixtures } = useFixtures(jwt, apiToken);
//   const liveScores = useLiveScores(fixtures, jwt, apiToken);
//   const enrichedFixtures = fixtures.map(f => ({
//     ...f,
//     status: liveScores[f.id]?.status ?? (Date.now() < new Date(f.kickoff).getTime() ? 'upcoming' : 'live'),
//     score: liveScores[f.id]?.score ?? { home: 0, away: 0 },
//   }));
//   const { markets, loading, refresh } = useMarkets(enrichedFixtures);
//   const [filter, setFilter] = useState('All');
//   const [sort, setSort] = useState<'liquidity' | 'time'>('time');

//   const filtered = markets.filter(m => {
//     if (filter === 'All') return true;
//     return m.fixture.status.toLowerCase() === filter.toLowerCase();
//   });

//   const sorted = [...filtered].sort((a, b) => {
//     if (sort === 'liquidity') return b.totalLiquidity - a.totalLiquidity;
//     return new Date(a.fixture.kickoff).getTime() - new Date(b.fixture.kickoff).getTime();
//   });

//   // Stats
//   const totalLiquidity = markets.reduce((s, m) => s + m.vaultBalance, 0);
//   const liveCount = markets.filter(m => m.fixture.status === 'live').length;
//   const marketCount = markets.filter(m => m.exists).length;

//   return (
//     <div className="markets-page">
//       {/* Hero Stats */}
//       <div className="markets-hero">
//         <motion.div
//           initial={{ opacity: 0, y: -20 }}
//           animate={{ opacity: 1, y: 0 }}
//           className="hero-content"
//         >
//           <div className="hero-badge">
//             <span className="live-dot" />
//             2026 FIFA World Cup
//           </div>
//           <h1 className="hero-title">Prediction Markets</h1>
//           <p className="hero-sub">
//             Trade on World Cup outcomes with cryptographic proof verification on Solana
//           </p>
//         </motion.div>

//         <motion.div
//           initial={{ opacity: 0 }}
//           animate={{ opacity: 1 }}
//           transition={{ delay: 0.2 }}
//           className="hero-stats"
//         >
//           <div className="hero-stat">
//             <span className="hs-val">{marketCount}</span>
//             <span className="hs-label">Active Markets</span>
//           </div>
//           <div className="hs-divider" />
//           <div className="hero-stat">
//             <span className="hs-val">{liveCount}</span>
//             <span className="hs-label">Live Now</span>
//           </div>
//           <div className="hs-divider" />
//           <div className="hero-stat">
//             <span className="hs-val">
//               ${totalLiquidity > 0 ? totalLiquidity.toLocaleString('en', { maximumFractionDigits: 0 }) : '—'}
//             </span>
//             <span className="hs-label">Total Liquidity</span>
//           </div>
//           <div className="hs-divider" />
//           <div className="hero-stat">
//             <span className="hs-val">Devnet</span>
//             <span className="hs-label">Network</span>
//           </div>
//         </motion.div>
//       </div>

//       {/* Filters */}
//       <div className="markets-toolbar">
//         <div className="filter-tabs tabs">
//           {FILTERS.map(f => (
//             <button
//               key={f}
//               className={`tab ${filter === f ? 'active' : ''}`}
//               onClick={() => setFilter(f)}
//             >
//               {f}
//               {f === 'Live' && liveCount > 0 && (
//                 <span className="filter-count">{liveCount}</span>
//               )}
//             </button>
//           ))}
//         </div>

//         <div className="sort-controls">
//           <span className="sort-label">Sort by</span>
//           <button
//             className={`sort-btn ${sort === 'time' ? 'active' : ''}`}
//             onClick={() => setSort('time')}
//           >
//             Kickoff
//           </button>
//           <button
//             className={`sort-btn ${sort === 'liquidity' ? 'active' : ''}`}
//             onClick={() => setSort('liquidity')}
//           >
//             Liquidity
//           </button>
//           <button
//             className="btn btn-ghost btn-sm refresh-btn"
//             onClick={refresh}
//           >
//             ↻ Refresh
//           </button>
//         </div>
//       </div>

//       {/* Market Grid */}
//       {loading ? (
//         <div className="markets-loading">
//           <div className="loading-grid">
//             {[1, 2, 3, 4, 5, 6].map(i => (
//               <div key={i} className="skeleton-card glass-card" />
//             ))}
//           </div>
//           <p className="loading-text">Fetching markets from Solana devnet...</p>
//         </div>
//       ) : sorted.length === 0 ? (
//         <div className="markets-empty">
//           <div className="empty-icon">⚽</div>
//           <h3>No markets found</h3>
//           <p>Try changing your filter or refreshing</p>
//         </div>
//       ) : (
//         <div className="markets-grid">
//           {sorted.map((market, i) => (
//             <MarketCard key={market.fixture.id} market={market} index={i} />
//           ))}
//         </div>
//       )}
//     </div>
//   );
// };

// export default MarketsPage;

// import React, { useState } from 'react';
// import { motion } from 'framer-motion';
// import { useMarkets } from '../hooks/useMarkets';
// import MarketCard from '../components/MarketCard';
// import { useFixtures } from '../hooks/useFixtures';
// import { useLiveScores } from '../hooks/useLiveScores';
// import './MarketsPage.css';

// const FILTERS = ['All', 'Live', 'Upcoming', 'Resolved'];

// const MarketsPage: React.FC = () => {
//   const [jwt] = useState<string | null>(import.meta.env.VITE_TXLINE_JWT ?? null);
//   const [apiToken] = useState<string | null>(import.meta.env.VITE_TXLINE_API_TOKEN ?? null);

//   const { fixtures } = useFixtures(jwt, apiToken);
//   const liveScores = useLiveScores(fixtures, jwt, apiToken);
//   const enrichedFixtures = fixtures.map(f => ({
//     ...f,
//     status: liveScores[f.id]?.status ?? (Date.now() < new Date(f.kickoff).getTime() ? 'upcoming' : 'live'),
//     score: liveScores[f.id]?.score ?? { home: 0, away: 0 },
//   }));
//   const { markets, loading, refresh } = useMarkets(enrichedFixtures);
//   const [filter, setFilter] = useState('All');
//   const [sort, setSort] = useState<'liquidity' | 'time'>('time');

//   const filtered = markets.filter(m => {
//     if (filter === 'All') return true;
//     return m.fixture.status.toLowerCase() === filter.toLowerCase();
//   });

//   const sorted = [...filtered].sort((a, b) => {
//     if (sort === 'liquidity') return b.totalLiquidity - a.totalLiquidity;
//     return new Date(a.fixture.kickoff).getTime() - new Date(b.fixture.kickoff).getTime();
//   });

//   const totalLiquidity = markets.reduce((s, m) => s + m.vaultBalance, 0);
//   const liveCount = markets.filter(m => m.fixture.status === 'live').length;
//   const marketCount = markets.filter(m => m.exists).length;

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import MarketCard from '../components/MarketCard';
import type { MarketInfo } from '../hooks/useMarkets';
import './MarketsPage.css';

const FILTERS = ['All', 'Live', 'Upcoming', 'Resolved'];

interface MarketsPageProps {
  markets: MarketInfo[];
  loading: boolean;
  refresh: () => void;
}

const MarketsPage: React.FC<MarketsPageProps> = ({ markets, loading, refresh }) => {
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState<'liquidity' | 'time'>('time');

  const filtered = markets.filter(m => {
    if (filter === 'All') return true;
    return m.fixture.status.toLowerCase() === filter.toLowerCase();
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'liquidity') return b.totalLiquidity - a.totalLiquidity;
    return new Date(a.fixture.kickoff).getTime() - new Date(b.fixture.kickoff).getTime();
  });

  const totalLiquidity = markets.reduce((s, m) => s + m.vaultBalance, 0);
  const liveCount = markets.filter(m => m.fixture.status === 'live').length;
  const marketCount = markets.filter(m => m.exists).length;

  return (
    <div className="markets-page">
      <div className="markets-hero">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="hero-content"
        >
          <div className="hero-badge">
            <span className="live-dot" />
            2026 FIFA World Cup
          </div>
          <h1 className="hero-title">Prediction Markets</h1>
          <p className="hero-sub">
            Trade on World Cup outcomes with cryptographic proof verification on Solana
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="hero-stats"
        >
          <div className="hero-stat">
            <span className="hs-val">{marketCount}</span>
            <span className="hs-label">Active Markets</span>
          </div>
          <div className="hs-divider" />
          <div className="hero-stat">
            <span className="hs-val">{liveCount}</span>
            <span className="hs-label">Live Now</span>
          </div>
          <div className="hs-divider" />
          <div className="hero-stat">
            <span className="hs-val">
              ${totalLiquidity > 0 ? totalLiquidity.toLocaleString('en', { maximumFractionDigits: 0 }) : '—'}
            </span>
            <span className="hs-label">Total Liquidity</span>
          </div>
          <div className="hs-divider" />
          <div className="hero-stat">
            <span className="hs-val">Devnet</span>
            <span className="hs-label">Network</span>
          </div>
        </motion.div>
      </div>

      <div className="markets-toolbar">
        <div className="filter-tabs tabs">
          {FILTERS.map(f => (
            <button
              key={f}
              className={`tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
              {f === 'Live' && liveCount > 0 && (
                <span className="filter-count">{liveCount}</span>
              )}
            </button>
          ))}
        </div>

        <div className="sort-controls">
          <span className="sort-label">Sort by</span>
          <button
            className={`sort-btn ${sort === 'time' ? 'active' : ''}`}
            onClick={() => setSort('time')}
          >
            Kickoff
          </button>
          <button
            className={`sort-btn ${sort === 'liquidity' ? 'active' : ''}`}
            onClick={() => setSort('liquidity')}
          >
            Liquidity
          </button>
          <button
            className="btn btn-ghost btn-sm refresh-btn"
            onClick={refresh}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="markets-loading">
          <div className="loading-grid">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="skeleton-card glass-card" />
            ))}
          </div>
          <p className="loading-text">Fetching markets from Solana devnet...</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="markets-empty">
          <div className="empty-icon">⚽</div>
          <h3>No markets found</h3>
          <p>Try changing your filter or refreshing</p>
        </div>
      ) : (
        <div className="markets-grid">
          {sorted.map((market, i) => (
            <MarketCard key={market.fixture.id} market={market} index={i} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MarketsPage;