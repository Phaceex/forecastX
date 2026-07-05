import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { MarketInfo } from '../hooks/useMarkets';
import PriceChart from './PriceChart';
import './MarketCard.css';

interface MarketCardProps {
  market: MarketInfo;
  index: number;
}

const MarketCard: React.FC<MarketCardProps> = ({ market, index }) => {
  const { fixture } = market;
  const yesPercent = (market.yesPrice * 100).toFixed(1);
  const noPercent = (market.noPrice * 100).toFixed(1);

  const statusConfig = {
    live: { label: 'LIVE', cls: 'tag-green', dot: true },
    upcoming: { label: 'UPCOMING', cls: 'tag-blue', dot: false },
    resolved: { label: 'RESOLVED', cls: 'tag-gray', dot: false },
  };
  const sc = statusConfig[fixture.status as keyof typeof statusConfig] || statusConfig.upcoming;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35 }}
      className="market-card glass-card"
    >
      {/* Header */}
      <div className="mc-header">
        <div className="mc-teams">
          <div className="mc-team">
            <span className="mc-flag">{fixture.homeLogo}</span>
            <span className="mc-code">{fixture.homeCode}</span>
            {fixture.status === 'live' && (
              <span className="mc-score">{fixture.score.home}</span>
            )}
          </div>
          <div className="mc-separator">
            {fixture.status === 'live' ? (
              <span className="mc-vs-live">LIVE</span>
            ) : (
              <span className="mc-vs">vs</span>
            )}
          </div>
          <div className="mc-team">
            {fixture.status === 'live' && (
              <span className="mc-score">{fixture.score.away}</span>
            )}
            <span className="mc-code">{fixture.awayCode}</span>
            <span className="mc-flag">{fixture.awayLogo}</span>
          </div>
        </div>
        <div className="mc-meta">
          <span className={`tag ${sc.cls}`}>
            {sc.dot && <span className="live-dot" style={{ width: 6, height: 6 }} />}
            {sc.label}
          </span>
          <span className="mc-group tag tag-gold">{fixture.group}</span>
        </div>
      </div>

      {/* Venue + stat */}
      <div className="mc-info">
        <span className="mc-venue">📍 {fixture.venue}</span>
        <span className="mc-stat">Stat: {fixture.statName}</span>
      </div>

      {/* Chart */}
      <div className="mc-chart">
        <PriceChart yesPrice={market.yesPrice} marketId={String(fixture.id)} />
      </div>

      {/* Prices */}
      <div className="mc-prices">
        <div className="mc-price-yes">
          <span className="mc-price-label">YES</span>
          <span className="mc-price-val yes">{yesPercent}¢</span>
          <div className="mc-prob-bar">
            <div className="mc-prob-fill yes" style={{ width: `${yesPercent}%` }} />
          </div>
        </div>
        <div className="mc-price-no">
          <div className="mc-prob-bar">
            <div className="mc-prob-fill no" style={{ width: `${noPercent}%` }} />
          </div>
          <span className="mc-price-val no">{noPercent}¢</span>
          <span className="mc-price-label">NO</span>
        </div>
      </div>

      {/* Footer */}
      <div className="mc-footer">
        <div className="mc-liquidity">
          <span className="mc-liq-label">Liquidity</span>
          <span className="mc-liq-val">
            {market.totalLiquidity > 0
              ? `$${market.totalLiquidity.toLocaleString('en', { maximumFractionDigits: 0 })}`
              : market.exists ? '$—' : 'Not Listed'
            }
          </span>
        </div>
        <Link
          to={`/market/${fixture.id}`}
          className="btn btn-primary btn-sm mc-trade-btn"
        >
          {market.exists ? 'Trade →' : 'List Market →'}
        </Link>
      </div>
    </motion.div>
  );
};

export default MarketCard;
