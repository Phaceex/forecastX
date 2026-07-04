import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTokenBalance } from '../hooks/useTokenBalance';
import './Navbar.css';

const Navbar: React.FC = () => {
  const location = useLocation();
  const { connected } = useWallet();
  const { usdcBalance, solBalance } = useTokenBalance();

  const navLinks = [
    { path: '/', label: 'Markets' },
    { path: '/portfolio', label: 'Portfolio' },
    { path: '/liquidity', label: 'Liquidity' },
    { path: '/faucet', label: 'Faucet' },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <Link to="/" className="navbar-logo">
          <div className="logo-icon">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="10" stroke="#60a5fa" strokeWidth="1.5"/>
              <path d="M11 4l2.5 5.5L19 11l-5.5 2.5L11 19l-2.5-5.5L3 11l5.5-2.5L11 4z"
                fill="#3b82f6" opacity="0.8"/>
            </svg>
          </div>
          <span className="logo-text">Forecast<span className="logo-x">X</span></span>
          <span className="logo-tag">Devnet</span>
        </Link>

        {/* Nav links */}
        <div className="navbar-links">
          {navLinks.map(link => (
            <Link
              key={link.path}
              to={link.path}
              className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right section */}
        <div className="navbar-right">
          {connected && (
            <div className="balance-chips">
              <div className="balance-chip">
                <span className="balance-label">USDC</span>
                <span className="balance-value">
                  {usdcBalance !== null ? usdcBalance.toLocaleString('en', { maximumFractionDigits: 2 }) : '...'}
                </span>
              </div>
              <div className="balance-chip">
                <span className="balance-label">SOL</span>
                <span className="balance-value">
                  {solBalance !== null ? solBalance.toFixed(3) : '...'}
                </span>
              </div>
            </div>
          )}
          <WalletMultiButton className="wallet-btn" />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
