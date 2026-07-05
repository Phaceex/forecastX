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


export const WORLD_CUP_COMPETITION_ID = 72;
export const TXLINE_API_ORIGIN = {
  mainnet: "https://txline.txodds.com",
  devnet: "https://txline-dev.txodds.com",
} as const;