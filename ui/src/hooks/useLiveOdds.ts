import { useState, useEffect } from 'react';
import { fetchOddsUpdates } from '../lib/txline';
import type { OddsUpdate } from '../lib/txline';

export interface MarketOdds {
    type: string;
    line?: string;
    period?: string;
    outcomes: Array<{
        name: string;
        price: number; // decimal odds (e.g. 1.85)
        probability: number; // percentage (e.g. 54.0)
    }>;
}

export function useLiveOdds(fixtureId: number | undefined, jwt: string | null, apiToken: string | null) {
    const [odds, setOdds] = useState<OddsUpdate[]>([]);
    const [parsedMarkets, setParsedMarkets] = useState<Record<string, MarketOdds>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!fixtureId || !jwt || !apiToken) return;

        let active = true;
        setLoading(true);

        const fetchOdds = async () => {
            try {
                const data = await fetchOddsUpdates(fixtureId, jwt, apiToken);
                if (!active) return;
                setOdds(data);
                setError(null);

                // Parse markets
                const markets: Record<string, MarketOdds> = {};

                // Find the latest update for 1X2_PARTICIPANT_RESULT with valid prices
                const resultUpdate = [...data]
                    .reverse()
                    .find(u => 
                        u.SuperOddsType === '1X2_PARTICIPANT_RESULT' && 
                        u.MarketPeriod === null &&
                        u.Prices &&
                        u.Prices.length === u.PriceNames.length &&
                        u.Prices.every(p => p !== null && p !== undefined && p > 0)
                    );
                if (resultUpdate) {
                    markets['1X2'] = {
                        type: '1X2',
                        outcomes: resultUpdate.PriceNames.map((name, i) => {
                            const rawPrice = resultUpdate.Prices[i];
                            const price = rawPrice / 1000;
                            const pctVal = resultUpdate.Pct && resultUpdate.Pct[i];
                            const probability = pctVal && pctVal !== 'NA' ? Number(pctVal) : (1 / price) * 100;
                            return { name, price, probability };
                        })
                    };
                }

                // Find the latest updates for OVERUNDER_PARTICIPANT_GOALS (group by line parameters) with valid prices
                const ouUpdates = [...data]
                    .reverse()
                    .filter(u => 
                        u.SuperOddsType === 'OVERUNDER_PARTICIPANT_GOALS' && 
                        u.MarketPeriod === null &&
                        u.Prices &&
                        u.Prices.length === u.PriceNames.length &&
                        u.Prices.every(p => p !== null && p !== undefined && p > 0)
                    );

                const seenLines = new Set<string>();
                ouUpdates.forEach(u => {
                    const line = u.MarketParameters || 'line=2.5';
                    if (!seenLines.has(line)) {
                        seenLines.add(line);
                        markets[`OU_${line}`] = {
                            type: 'OVERUNDER',
                            line,
                            outcomes: u.PriceNames.map((name, i) => {
                                const rawPrice = u.Prices[i];
                                const price = rawPrice / 1000;
                                const pctVal = u.Pct && u.Pct[i];
                                const probability = pctVal && pctVal !== 'NA' ? Number(pctVal) : (1 / price) * 100;
                                return { name, price, probability };
                            })
                        };
                    }
                });

                setParsedMarkets(markets);
            } catch (err: any) {
                if (!active) return;
                console.error("Failed to fetch live odds:", err);
                setError(err?.message || String(err));
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchOdds();
        const interval = setInterval(fetchOdds, 15_000);

        return () => {
            active = false;
            clearInterval(interval);
        };
    }, [fixtureId, jwt, apiToken]);

    return { odds, parsedMarkets, loading, error };
}
