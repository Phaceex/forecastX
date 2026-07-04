// Devnet configuration
export const PROGRAM_ID = '6N6ckvYjUgGZCgwoE6XCQbsMuoxjUvoT3QYUt6LbfTbi';
export const COLLATERAL_MINT = 'y1NRCJLaggE1VGo3z3tzgut96U6UVmWLxytkjAN1aqT';
export const RPC_URL = 'https://api.devnet.solana.com';


// Explicit type definition (must come before the array)
export interface Fixture {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  homeCode: string;
  awayCode: string;
  kickoff: string;
  statKey: number;
  statName: string;
  group: string;
  venue: string;
  status: 'live' | 'upcoming' | 'resolved';
  score: { home: number; away: number };
  winningOutcome?: number;
}


// No second `Fixture` type needed — WORLD_CUP_FIXTURES is already typed as Fixture[]

// // World Cup fixtures with metadata
export const WORLD_CUP_FIXTURES = [
  {
    id: 18179550,
    homeTeam: 'Brazil',
    awayTeam: 'Argentina',
    homeLogo: '🇧🇷',
    awayLogo: '🇦🇷',
    homeCode: 'BRA',
    awayCode: 'ARG',
    kickoff: '2026-07-14T18:00:00Z',
    statKey: 2,
    statName: 'Total Goals',
    group: 'Final',
    venue: 'MetLife Stadium, New York',
    status: 'live',
    score: { home: 1, away: 1 },
  },
  {
    id: 18179551,
    homeTeam: 'France',
    awayTeam: 'England',
    homeLogo: '🇫🇷',
    awayLogo: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    homeCode: 'FRA',
    awayCode: 'ENG',
    kickoff: '2026-07-10T18:00:00Z',
    statKey: 2,
    statName: 'Total Goals',
    group: 'SF',
    venue: 'AT&T Stadium, Dallas',
    status: 'upcoming',
    score: { home: 0, away: 0 },
  },
  {
    id: 18179552,
    homeTeam: 'Spain',
    awayTeam: 'Germany',
    homeLogo: '🇪🇸',
    awayLogo: '🇩🇪',
    homeCode: 'ESP',
    awayCode: 'GER',
    kickoff: '2026-07-10T22:00:00Z',
    statKey: 2,
    statName: 'Total Goals',
    group: 'SF',
    venue: 'Rose Bowl, Los Angeles',
    status: 'upcoming',
    score: { home: 0, away: 0 },
  },
  {
    id: 18179553,
    homeTeam: 'Portugal',
    awayTeam: 'Netherlands',
    homeLogo: '🇵🇹',
    awayLogo: '🇳🇱',
    homeCode: 'POR',
    awayCode: 'NED',
    kickoff: '2026-07-06T18:00:00Z',
    statKey: 2,
    statName: 'Total Goals',
    group: 'QF',
    venue: 'Hard Rock Stadium, Miami',
    status: 'resolved',
    score: { home: 3, away: 1 },
    winningOutcome: 1,
  },
  {
    id: 18179554,
    homeTeam: 'Morocco',
    awayTeam: 'USA',
    homeLogo: '🇲🇦',
    awayLogo: '🇺🇸',
    homeCode: 'MAR',
    awayCode: 'USA',
    kickoff: '2026-07-07T22:00:00Z',
    statKey: 2,
    statName: 'Total Goals',
    group: 'QF',
    venue: 'SoFi Stadium, LA',
    status: 'resolved',
    score: { home: 2, away: 2 },
    winningOutcome: 1,
  },
  {
    id: 18179555,
    homeTeam: 'Japan',
    awayTeam: 'Croatia',
    homeLogo: '🇯🇵',
    awayLogo: '🇭🇷',
    homeCode: 'JPN',
    awayCode: 'CRO',
    kickoff: '2026-07-04T14:00:00Z',
    statKey: 2,
    statName: 'Total Goals',
    group: 'R16',
    venue: 'Gillette Stadium, Boston',
    status: 'upcoming',
    score: { home: 0, away: 0 },
  },
];

// export type Fixture = typeof WORLD_CUP_FIXTURES[0];
