import React, { useState, useEffect, useRef } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface PricePoint {
  time: string;
  yes: number;
  no: number;
}

function generateHistory(baseYes: number): PricePoint[] {
  const points: PricePoint[] = [];
  let y = baseYes;
  for (let i = 60; i >= 0; i--) {
    y = Math.max(0.05, Math.min(0.95, y + (Math.random() - 0.5) * 0.03));
    const t = new Date(Date.now() - i * 60000);
    points.push({
      time: `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`,
      yes: Math.round(y * 1000) / 10,
      no: Math.round((1 - y) * 1000) / 10,
    });
  }
  return points;
}

interface PriceChartProps {
  yesPrice: number;
  marketId: string;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(4, 15, 30, 0.97)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
      }}>
        <div style={{ color: '#22d3a0', fontWeight: 600 }}>YES {payload[0]?.value}¢</div>
        <div style={{ color: '#f87171', fontWeight: 600 }}>NO {payload[1]?.value}¢</div>
      </div>
    );
  }
  return null;
};

const PriceChart: React.FC<PriceChartProps> = ({ yesPrice, marketId }) => {
  const [data, setData] = useState<PricePoint[]>(() => generateHistory(yesPrice));

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => {
        const last = prev[prev.length - 1];
        const newYes = Math.max(5, Math.min(95, last.yes + (Math.random() - 0.5) * 2));
        const t = new Date();
        const newPoint: PricePoint = {
          time: `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`,
          yes: Math.round(newYes * 10) / 10,
          no: Math.round((100 - newYes) * 10) / 10,
        };
        return [...prev.slice(-60), newPoint];
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`yesGrad-${marketId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22d3a0" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22d3a0" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`noGrad-${marketId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f87171" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="time" hide />
        <YAxis domain={[0, 100]} hide />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="yes"
          stroke="#22d3a0"
          strokeWidth={1.5}
          fill={`url(#yesGrad-${marketId})`}
          dot={false}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="no"
          stroke="#f87171"
          strokeWidth={1.5}
          fill={`url(#noGrad-${marketId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default PriceChart;
