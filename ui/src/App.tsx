// import React from 'react';
// import { BrowserRouter, Routes, Route } from 'react-router-dom';
// import { WalletContextProvider } from './WalletProvider';
// import Navbar from './components/Navbar';
// import Ticker from './components/Ticker';
// import MarketsPage from './pages/MarketsPage';
// import TradingPage from './pages/TradingPage';
// import PortfolioPage from './pages/PortfolioPage';
// import LiquidityPage from './pages/LiquidityPage';
// import FaucetPage from './pages/FaucetPage';
// import './App.css';

// function AppLayout() {
//   return (
//     <div className="app-shell">
//       <Navbar />
//       <Ticker markets={markets} />
//       <main className="app-main">
//         <Routes>
//           <Route path="/" element={<MarketsPage />} />
//           <Route path="/market/:fixtureId" element={<TradingPage />} />
//           <Route path="/portfolio" element={<PortfolioPage />} />
//           <Route path="/liquidity" element={<LiquidityPage />} />
//           <Route path="/faucet" element={<FaucetPage />} />
//         </Routes>
//       </main>
//       <footer className="app-footer">
//         <div className="footer-inner">
//           <span className="footer-brand">ForecastX · 2026 FIFA World Cup</span>
//           <span className="footer-sep">·</span>
//           <span className="footer-chain">Powered by Solana Devnet</span>
//           <span className="footer-sep">·</span>
//           <a href={`https://explorer.solana.com/address/6N6ckvYjUgGZCgwoE6XCQbsMuoxjUvoT3QYUt6LbfTbi?cluster=devnet`} target="_blank" rel="noreferrer" className="footer-link">
//             Program ↗
//           </a>
//         </div>
//       </footer>
//     </div>
//   );
// }

// function App() {
//   return (
//     <WalletContextProvider>
//       <BrowserRouter>
//         <AppLayout />
//       </BrowserRouter>
//     </WalletContextProvider>
//   );
// }

// export default App;

import React, { useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WalletContextProvider } from './WalletProvider';
import Navbar from './components/Navbar';
import Ticker from './components/Ticker';
import MarketsPage from './pages/MarketsPage';
import TradingPage from './pages/TradingPage';
import PortfolioPage from './pages/PortfolioPage';
import LiquidityPage from './pages/LiquidityPage';
import FaucetPage from './pages/FaucetPage';
import { useFixtures } from './hooks/useFixtures';
import { useLiveScores } from './hooks/useLiveScores';
import { useMarkets } from './hooks/useMarkets';

import './App.css';

function AppLayout() {
  // const [jwt] = useState<string | null>(import.meta.env.VITE_TXLINE_JWT ?? null);
  const jwt = "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJleHAiOjE3ODU1MzY2ODMsInNlc3Npb25JZCI6ImFkM2Q2NDc2LTk4YmMtNGFkNi05NThlLTlmYTVlZjE0YjRlZSIsInJvbGUiOiJndWVzdCIsIm1heWJlQ2xpZW50SXAiOiIxNS4xNTguNDQuMTY5In0.am8jpxSS0mcR_CAdhBczfVT53mQmMu3bHHIOZNSOC3pcwr5ihjtYRMh0gUA_gDw603Iie0DwJyYFgieRSuKDWA"
  console.log(jwt, "the jwt token")
  // const [apiToken] = useState<string | null>(import.meta.env.VITE_TXLINE_API_TOKEN ?? null);
  const apiToken = "txoracle_api_43ff74385a4a4031b34dca19c4ee5737"
  console.log(apiToken, "the api token")
  const { fixtures } = useFixtures(jwt, apiToken);
  const liveScores = useLiveScores(fixtures, jwt, apiToken);
  const enrichedFixtures = useMemo(
    () =>
      fixtures.map(f => ({
        ...f,
        status: liveScores[f.id]?.status ?? (Date.now() < new Date(f.kickoff).getTime() ? 'upcoming' : 'live'),
        score: liveScores[f.id]?.score ?? { home: 0, away: 0 },
      })),
    [fixtures, liveScores]
  );
  const { markets, loading, refresh } = useMarkets(enrichedFixtures);

  return (
    <div className="app-shell">
      <Navbar />
      <Ticker markets={markets} />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<MarketsPage markets={markets} loading={loading} refresh={refresh} />} />
          <Route path="/market/:fixtureId" element={<TradingPage markets={markets} />} />
          <Route path="/portfolio" element={<PortfolioPage markets={markets} />} />
          <Route path="/liquidity" element={<LiquidityPage markets={markets} />} />
          <Route path="/faucet" element={<FaucetPage />} />
        </Routes>
      </main>
      <footer className="app-footer">
        <div className="footer-inner">
          <span className="footer-brand">ForecastX · 2026 FIFA World Cup</span>
          <span className="footer-sep">·</span>
          <span className="footer-chain">Powered by Solana Devnet</span>
          <span className="footer-sep">·</span>
          <a href={`https://explorer.solana.com/address/6N6ckvYjUgGZCgwoE6XCQbsMuoxjUvoT3QYUt6LbfTbi?cluster=devnet`} target="_blank" rel="noreferrer" className="footer-link">
            Program ↗
          </a>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <WalletContextProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </WalletContextProvider>
  );
}

export default App;