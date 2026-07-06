import { useEffect, useState, useRef } from 'react';
import { fetchScoreUpdates, deriveStatus, streamScoreUpdates } from '../lib/txline';
import type { Fixture } from '../config';

type LiveState = { status: Fixture['status']; score: { home: number; away: number } };

export function useLiveScores(fixtures: Fixture[], jwt: string | null, apiToken: string | null) {
    const [scores, setScores] = useState<Record<number, LiveState>>({});
    const streamsRef = useRef<Record<number, { 
        abort: () => void; 
        retryCount: number; 
        pollInterval: NodeJS.Timeout | null;
    }>>({});

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
                    const isFinalised = list.some(x => 
                        x.Action === 'game_finalised' || 
                        x.StatusId === 100 || 
                        x.action === 'game_finalised' || 
                        x.statusId === 100
                    );
                    const latest = list[list.length - 1];

                    const scoreEvents = list.filter(x => x.Score !== undefined || x.scoreSoccer !== undefined);
                    const latestScoreEvent = scoreEvents.length > 0 ? scoreEvents[scoreEvents.length - 1] : latest;
                    const score = latestScoreEvent.Score ?? latestScoreEvent.scoreSoccer;

                    setScores(prev => ({
                        ...prev,
                        [f.id]: {
                            status: isFinalised ? 'resolved' : deriveStatus(
                                latest.GameState ?? latest.gameState, 
                                true, 
                                latest.Action ?? latest.action, 
                                latest.StatusId ?? latest.statusId
                            ),
                            score: {
                                home: score?.Participant1.Total?.Goals ?? 0,
                                away: score?.Participant2.Total?.Goals ?? 0,
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
                const s = streamsRef.current[id];
                s?.abort();
                if (s?.pollInterval) clearInterval(s.pollInterval);
                delete streamsRef.current[id];
            }
        });

        // Start streaming for active/live fixtures
        relevant.forEach(f => {
            if (streamsRef.current[f.id]) return; // Already streaming

            const startStream = (): (() => void) => {
                const startPolling = () => {
                    const control = streamsRef.current[f.id];
                    if (control && !control.pollInterval) {
                        console.log(`Starting polling fallback for fixture ${f.id}`);
                        control.pollInterval = setInterval(async () => {
                            try {
                                const list = await fetchScoreUpdates(f.id, jwt, apiToken);
                                if (!activeIds.has(f.id)) return;
                                if (list.length > 0) {
                                    const isFinalised = list.some(x => 
                                        x.Action === 'game_finalised' || 
                                        x.StatusId === 100 || 
                                        x.action === 'game_finalised' || 
                                        x.statusId === 100
                                    );
                                    const latest = list[list.length - 1];

                                    const scoreEvents = list.filter(x => x.Score !== undefined || x.scoreSoccer !== undefined);
                                    const latestScoreEvent = scoreEvents.length > 0 ? scoreEvents[scoreEvents.length - 1] : latest;
                                    const score = latestScoreEvent.Score ?? latestScoreEvent.scoreSoccer;

                                    setScores(prev => ({
                                        ...prev,
                                        [f.id]: {
                                            status: isFinalised ? 'resolved' : deriveStatus(
                                                latest.GameState ?? latest.gameState, 
                                                true, 
                                                latest.Action ?? latest.action, 
                                                latest.StatusId ?? latest.statusId
                                            ),
                                            score: {
                                                home: score?.Participant1.Total?.Goals ?? prev[f.id]?.score.home ?? 0,
                                                away: score?.Participant2.Total?.Goals ?? prev[f.id]?.score.away ?? 0,
                                            }
                                        }
                                    }));
                                }
                            } catch (err) {
                                console.error(`Failed to poll score updates for ${f.id}:`, err);
                            }
                        }, 15000);
                    }
                };

                const abort = streamScoreUpdates(
                    f.id,
                    jwt,
                    apiToken,
                    (payload) => {
                        // Clear polling fallback if stream succeeds
                        const control = streamsRef.current[f.id];
                        if (control && control.pollInterval) {
                            console.log(`Stream succeeded for fixture ${f.id}, clearing polling fallback`);
                            clearInterval(control.pollInterval);
                            control.pollInterval = null;
                        }
                        const fixtureData = payload.data ?? payload;
                        if (fixtureData && (fixtureData.FixtureId === f.id || fixtureData.fixtureId === f.id)) {
                            const score = fixtureData.Score ?? fixtureData.scoreSoccer;
                            const gameState = fixtureData.GameState ?? fixtureData.gameState;
                            const action = fixtureData.Action ?? fixtureData.action;
                            const statusId = fixtureData.StatusId ?? fixtureData.statusId;

                            const isFinalised = action === 'game_finalised' || statusId === 100;

                            setScores(prev => {
                                const current = prev[f.id];
                                return {
                                    ...prev,
                                    [f.id]: {
                                        status: (current?.status === 'resolved' || isFinalised) ? 'resolved' : deriveStatus(gameState, true, action, statusId),
                                        score: {
                                            home: score?.Participant1?.Total?.Goals ?? current?.score.home ?? 0,
                                            away: score?.Participant2?.Total?.Goals ?? current?.score.away ?? 0,
                                        }
                                    }
                                };
                            });
                        }
                    },
                    (err) => {
                        console.error(`Stream error for fixture ${f.id}, starting polling fallback:`, err);
                        startPolling();
                        
                        // Implement retry logic with backoff if the fixture is still active
                        if (activeIds.has(f.id) && streamsRef.current[f.id]) {
                            const current = streamsRef.current[f.id];
                            if (current.retryCount < 5) {
                                current.retryCount += 1;
                                setTimeout(() => {
                                    if (activeIds.has(f.id)) {
                                        current.abort = startStream();
                                    }
                                }, 10000);
                            }
                        }
                    }
                );
                return abort;
            };

            streamsRef.current[f.id] = {
                abort: startStream(),
                retryCount: 0,
                pollInterval: null
            };
        });

        // Cleanup on unmount or dependency updates
        return () => {
            Object.values(streamsRef.current).forEach(s => {
                s.abort();
                if (s.pollInterval) clearInterval(s.pollInterval);
            });
            streamsRef.current = {};
        };
    }, [fixtures, jwt, apiToken]);

    return scores;
}