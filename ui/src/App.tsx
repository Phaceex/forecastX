import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WalletContextProvider } from './WalletProvider';
import Navbar from './components/Navbar';
import Ticker from './components/Ticker';
import MarketsPage from './pages/MarketsPage';
import TradingPage from './pages/TradingPage';
import PortfolioPage from './pages/PortfolioPage';
import LiquidityPage from './pages/LiquidityPage';
import FaucetPage from './pages/FaucetPage';
import './App.css';

function AppLayout() {
  return (
    <div className="app-shell">
      <Navbar />
      <Ticker />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<MarketsPage />} />
          <Route path="/market/:fixtureId" element={<TradingPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/liquidity" element={<LiquidityPage />} />
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
