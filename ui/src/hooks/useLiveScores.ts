import { useEffect, useState } from 'react';
import { fetchScoreUpdates, deriveStatus } from '../lib/txline';
import type { Fixture } from '../config';

type LiveState = { status: Fixture['status']; score: { home: number; away: number } };

export function useLiveScores(fixtures: Fixture[], jwt: string | null, apiToken: string | null) {
    const [scores, setScores] = useState<Record<number, LiveState>>({});

    useEffect(() => {
        if (!jwt || !apiToken || fixtures.length === 0) return;

        const poll = async () => {
            const now = Date.now();
            const relevant = fixtures.filter(f => now >= new Date(f.kickoff).getTime() - 5 * 60_000);
            const results = await Promise.all(
                relevant.map(f => fetchScoreUpdates(f.id, jwt, apiToken).catch(() => []))
            );
            setScores(prev => {
                const next = { ...prev };
                relevant.forEach((f, i) => {
                    const list = results[i];
                    if (list.length === 0) return;
                    const latest = list[list.length - 1];
                    next[f.id] = {
                        status: deriveStatus(latest.gameState, true),
                        score: {
                            home: latest.scoreSoccer?.Participant1.Total?.Goals ?? next[f.id]?.score.home ?? 0,
                            away: latest.scoreSoccer?.Participant2.Total?.Goals ?? next[f.id]?.score.away ?? 0,
                        },
                    };
                });
                return next;
            });
        };

        poll();
        const interval = setInterval(poll, 30_000);
        return () => clearInterval(interval);
    }, [fixtures, jwt, apiToken]);

    return scores;
}