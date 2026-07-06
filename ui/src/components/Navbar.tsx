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
    <>
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

      {/* Mobile Bottom Navigation Bar */}
      <div className="mobile-bottom-nav">
        {navLinks.map(link => {
          let icon;
          if (link.path === '/') {
            icon = (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
            );
          } else if (link.path === '/portfolio') {
            icon = (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" />
                <path d="M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
                <path d="M10 6V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" />
              </svg>
            );
          } else if (link.path === '/liquidity') {
            icon = (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            );
          } else {
            icon = (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v12M6 12h12" />
              </svg>
            );
          }
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`mb-nav-link ${location.pathname === link.path ? 'active' : ''}`}
            >
              <div className="mb-nav-icon">{icon}</div>
              <span className="mb-nav-label">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
};

export default Navbar;
