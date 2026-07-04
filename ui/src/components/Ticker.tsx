import React, { useState, useEffect, useRef } from 'react';
import { WORLD_CUP_FIXTURES } from '../config';
import './Ticker.css';

interface TickerItem {
  label: string;
  yes: number;
  no: number;
  status: string;
  homeCode: string;
  awayCode: string;
  homeLogo: string;
  awayLogo: string;
  score: { home: number; away: number };
}

const Ticker: React.FC = () => {
  const [prices, setPrices] = useState<TickerItem[]>(() =>
    WORLD_CUP_FIXTURES.map(f => ({
      label: `${f.homeCode} vs ${f.awayCode}`,
      homeCode: f.homeCode,
      awayCode: f.awayCode,
      homeLogo: f.homeLogo,
      awayLogo: f.awayLogo,
      yes: 0.48 + Math.random() * 0.1,
      no: 0.42 + Math.random() * 0.1,
      status: f.status,
      score: f.score,
    }))
  );

  // Simulate live price movements
  useEffect(() => {
    const interval = setInterval(() => {
      setPrices(prev =>
        prev.map(p => {
          const drift = (Math.random() - 0.5) * 0.02;
          const newYes = Math.max(0.05, Math.min(0.95, p.yes + drift));
          return { ...p, yes: newYes, no: 1 - newYes };
        })
      );
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  // Duplicate for seamless loop
  const items = [...prices, ...prices];

  return (
    <div className="ticker-wrapper">
      <div className="ticker-badge">
        <span className="live-dot" />
        LIVE
      </div>
      <div className="ticker-track">
        <div className="ticker-inner">
          {items.map((item, i) => (
            <div key={i} className="ticker-item">
              <span className="ticker-flags">{item.homeLogo}{item.awayLogo}</span>
              <span className="ticker-match">{item.homeCode}<span className="ticker-vs">vs</span>{item.awayCode}</span>
              {item.status === 'live' && (
                <span className="ticker-score">{item.score.home}–{item.score.away}</span>
              )}
              <span className="ticker-yes">YES {(item.yes * 100).toFixed(1)}¢</span>
              <span className="ticker-divider">|</span>
              <span className="ticker-no">NO {(item.no * 100).toFixed(1)}¢</span>
              <span className="ticker-sep">◆</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Ticker;
