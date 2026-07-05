import axios from "axios";
import { TXLINE_API_ORIGIN, WORLD_CUP_COMPETITION_ID } from "../config";

export interface TxLineFixture {
    Ts: number;
    StartTime: number;
    Competition: string;
    CompetitionId: number;
    FixtureGroupId: number;
    Participant1Id: number;
    Participant1: string;
    Participant2Id: number;
    Participant2: string;
    FixtureId: number;
    Participant1IsHome: boolean;
}

function toEpochDay(date: Date): number {
    return Math.floor(date.getTime() / 86_400_000);
}

export async function fetchAllWorldCupFixtures(
    jwt: string,
    apiToken: string,
    network: "mainnet" | "devnet" = "devnet"
): Promise<TxLineFixture[]> {
    const httpClient = axios.create({
        timeout: 30000,
        baseURL: TXLINE_API_ORIGIN[network],
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
            "X-Api-Token": apiToken,
        },
    });

    const seen = new Map<number, TxLineFixture>();
    const tournamentStart = toEpochDay(new Date("2026-06-11"));
    const tournamentEnd = toEpochDay(new Date("2026-07-19"));

    for (let day = tournamentStart; day <= tournamentEnd; day += 30) {
        const res = await httpClient.get<TxLineFixture[]>("/api/fixtures/snapshot", {
            // params: { startEpochDay: day },
            // competitionId: WORLD_CUP_COMPETITION_ID, 
            params: { competitionId: 72 },
        });
        for (const fixture of res.data) seen.set(fixture.FixtureId, fixture);
    }

    return [...seen.values()];
}


export interface ScoreUpdate {
    fixtureId: number;
    gameState: string;
    scoreSoccer?: {
        Participant1: { Total?: { Goals: number } };
        Participant2: { Total?: { Goals: number } };
    };
}

export async function fetchScoreUpdates(
    fixtureId: number,
    jwt: string,
    apiToken: string,
    network: "mainnet" | "devnet" = "devnet"
): Promise<ScoreUpdate[]> {
    const res = await axios.get(`${TXLINE_API_ORIGIN[network]}/api/scores/updates/${fixtureId}`, {
        headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken },
    });
    return res.data;
}

const LIVE_STATES = new Set(['H1', 'HT', 'H2', 'ET1', 'ET2', 'P', 'PE']);
const FINISHED_STATES = new Set(['F', 'END', 'WET', 'WPE', 'A', 'C']);

export function deriveStatus(gameState: string | undefined, started: boolean): 'live' | 'upcoming' | 'resolved' {
    if (gameState && FINISHED_STATES.has(gameState)) return 'resolved';
    if (gameState && LIVE_STATES.has(gameState)) return 'live';
    return started ? 'live' : 'upcoming';
}

const TEAM_META: Record<string, { code: string; flag: string }> = {
    Brazil: { code: 'BRA', flag: '🇧🇷' },
    Argentina: { code: 'ARG', flag: '🇦🇷' },
    France: { code: 'FRA', flag: '🇫🇷' },
    England: { code: 'ENG', flag: '🏴' },
    Spain: { code: 'ESP', flag: '🇪🇸' },
    Germany: { code: 'GER', flag: '🇩🇪' },
    Portugal: { code: 'POR', flag: '🇵🇹' },
    Netherlands: { code: 'NED', flag: '🇳🇱' },
    Morocco: { code: 'MAR', flag: '🇲🇦' },
    USA: { code: 'USA', flag: '🇺🇸' },
    Japan: { code: 'JPN', flag: '🇯🇵' },
    Croatia: { code: 'CRO', flag: '🇭🇷' },
    // add remaining teams as they appear in your fixture list
};

function teamMeta(name: string) {
    return TEAM_META[name] ?? { code: name.slice(0, 3).toUpperCase(), flag: '🏳️' };
}

export function toFixture(raw: TxLineFixture) {
    const homeTeam = raw.Participant1IsHome ? raw.Participant1 : raw.Participant2;
    const awayTeam = raw.Participant1IsHome ? raw.Participant2 : raw.Participant1;
    const home = teamMeta(homeTeam);
    const away = teamMeta(awayTeam);
    return {
        id: raw.FixtureId,
        homeTeam,
        awayTeam,
        homeCode: home.code,
        awayCode: away.code,
        homeLogo: home.flag,
        awayLogo: away.flag,
        kickoff: new Date(raw.StartTime).toISOString(),
        statKey: 2,
        statName: "Total Goals",
    };
}