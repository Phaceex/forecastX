import { useEffect, useState, useRef } from 'react';
import { fetchScoreUpdates, deriveStatus, streamScoreUpdates } from '../lib/txline';
import type { Fixture } from '../config';

type LiveState = { status: Fixture['status']; score: { home: number; away: number } };

export function useLiveScores(fixtures: Fixture[], jwt: string | null, apiToken: string | null) {
    const [scores, setScores] = useState<Record<number, LiveState>>({});
    const streamsRef = useRef<Record<number, { abort: () => void; retryCount: number }>>({});

    useEffect(() => {
        if (!jwt || !apiToken || fixtures.length === 0) return;

        const now = Date.now();
        // Fixtures starting soon (within 10 minutes) or already started
        const relevant = fixtures.filter(f => now >= new Date(f.kickoff).getTime() - 10 * 60_000);
        const activeIds = new Set(relevant.map(f => f.id));

        // 1. Initial snapshot fetch via REST API
        relevant.forEach(async (f) => {
            try {
                const list = await fetchScoreUpdates(f.id, jwt, apiToken);
                if (list.length > 0) {
                    const latest = list[list.length - 1];
                    setScores(prev => ({
                        ...prev,
                        [f.id]: {
                            status: deriveStatus(latest.gameState, true),
                            score: {
                                home: latest.scoreSoccer?.Participant1.Total?.Goals ?? 0,
                                away: latest.scoreSoccer?.Participant2.Total?.Goals ?? 0,
                            }
                        }
                    }));
                }
            } catch (err) {
                console.error(`Failed to fetch initial scores for ${f.id}:`, err);
            }
        });

        // 2. Manage real-time SSE stream subscriptions
        // Terminate streams for fixtures that are no longer active/relevant
        Object.keys(streamsRef.current).forEach(idStr => {
            const id = Number(idStr);
            if (!activeIds.has(id)) {
                streamsRef.current[id]?.abort();
                delete streamsRef.current[id];
            }
        });

        // Start streaming for active/live fixtures
        relevant.forEach(f => {
            if (streamsRef.current[f.id]) return; // Already streaming

            const startStream = (): (() => void) => {
                const abort = streamScoreUpdates(
                    f.id,
                    jwt,
                    apiToken,
                    (payload) => {
                        const fixtureData = payload.data ?? payload;
                        if (fixtureData && fixtureData.fixtureId === f.id) {
                            const scoreSoccer = fixtureData.scoreSoccer;
                            setScores(prev => ({
                                ...prev,
                                [f.id]: {
                                    status: deriveStatus(fixtureData.gameState, true),
                                    score: {
                                        home: scoreSoccer?.Participant1?.Total?.Goals ?? prev[f.id]?.score.home ?? 0,
                                        away: scoreSoccer?.Participant2?.Total?.Goals ?? prev[f.id]?.score.away ?? 0,
                                    }
                                }
                            }));
                        }
                    },
                    (err) => {
                        console.error(`Stream error for fixture ${f.id}:`, err);
                        // Implement retry logic with exponential backoff if the fixture is still active
                        if (activeIds.has(f.id) && streamsRef.current[f.id]) {
                            const current = streamsRef.current[f.id];
                            if (current.retryCount < 5) {
                                current.retryCount += 1;
                                setTimeout(() => {
                                    if (activeIds.has(f.id)) {
                                        current.abort = startStream();
                                    }
                                }, 5000);
                            }
                        }
                    }
                );
                return abort;
            };

            streamsRef.current[f.id] = {
                abort: startStream(),
                retryCount: 0
            };
        });

        // Cleanup on unmount or dependency updates
        return () => {
            Object.values(streamsRef.current).forEach(s => s.abort());
            streamsRef.current = {};
        };
    }, [fixtures, jwt, apiToken]);

    return scores;
}