// import axios from "axios";
// import * as dotenv from "dotenv";

// dotenv.config();

// const CONFIG = {
//   mainnet: {
//     apiOrigin: "https://txline.txodds.com",
//   },
//   devnet: {
//     apiOrigin: "https://txline-dev.txodds.com",
//   },
// } as const;

// async function main() {
//   const network = (process.env.NETWORK || "devnet").toLowerCase() as "mainnet" | "devnet";
//   const { apiOrigin } = CONFIG[network];

//   const jwt = process.env.GUEST_JWT;
//   const apiToken = process.env.API_TOKEN;

//   if (!jwt || !apiToken) {
//     console.error("Error: GUEST_JWT or API_TOKEN not set in .env. Please run activate-token first.");
//     process.exit(1);
//   }

//   console.log(`Connecting to TxLINE API at: ${apiOrigin}`);
//   console.log(`Using API Token: ${apiToken}`);

//   const httpClient = axios.create({
//     timeout: 30000,
//     headers: {
//       "Content-Type": "application/json",
//       "Authorization": `Bearer ${jwt}`,
//       "X-Api-Token": apiToken,
//     },
//     baseURL: apiOrigin,
//   });

//   try {
//     console.log("Fetching fixtures snapshot...");
//     const response = await httpClient.get("/api/fixtures/snapshot");
//     const fixtures = response.data;

//     console.log("\n==================================================");
//     console.log(`SUCCESS: Retrieved ${fixtures.length} fixtures!`);
//     console.log("==================================================\n");

//     if (fixtures.length === 0) {
//       console.log("No fixtures returned. This might be because there are no upcoming scheduled matches in this tier right now.");
//       return;
//     }

//     // Inspect unique competitions
//     const competitions = new Map<number, string>();
//     fixtures.forEach((f: any) => {
//       if (f.CompetitionId) {
//         competitions.set(f.CompetitionId, f.CompetitionName || `Competition ${f.CompetitionId}`);
//       }
//     });

//     console.log(`Found ${competitions.size} unique competitions in the dataset:`);
//     competitions.forEach((name, id) => {
//       console.log(`- ID ${id}: ${name}`);
//     });
//     console.log("");

//     console.log("Sample Fixtures (up to 5):");
//     fixtures.slice(0, 5).forEach((fixture: any, index: number) => {
//       const homeTeam = fixture.Participant1IsHome ? fixture.Participant1 : fixture.Participant2;
//       const awayTeam = fixture.Participant1IsHome ? fixture.Participant2 : fixture.Participant1;

//       console.log(`${index + 1}. [${fixture.CompetitionName || `Comp ${fixture.CompetitionId}`}]`);
//       console.log(`   ${homeTeam} vs ${awayTeam}`);
//       console.log(`   Fixture ID: ${fixture.FixtureId}`);
//       console.log(`   Start Time: ${fixture.StartTime ? new Date(fixture.StartTime).toISOString() : "N/A"}`);
//       console.log("--------------------------------------------------");
//     });

//   } catch (error: any) {
//     console.error("API Call Failed:");
//     if (error.response) {
//       console.error(`Status: ${error.response.status}`);
//       console.error("Data:", error.response.data);
//     } else {
//       console.error(error.message);
//     }
//     process.exit(1);
//   }
// }

// main().catch((err) => {
//   console.error(err);
//   process.exit(1);
// });

import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const CONFIG = {
  mainnet: { apiOrigin: "https://txline.txodds.com" },
  devnet: { apiOrigin: "https://txline-dev.txodds.com" },
} as const;

interface TxLineFixture {
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

async function main() {
  const network = (process.env.NETWORK || "devnet").toLowerCase() as "mainnet" | "devnet";
  const { apiOrigin } = CONFIG[network];

  const jwt = process.env.GUEST_JWT;
  const apiToken = process.env.API_TOKEN;

  if (!jwt || !apiToken) {
    console.error("Error: GUEST_JWT or API_TOKEN not set in .env. Please run activate-token first.");
    process.exit(1);
  }

  console.log(`Connecting to TxLINE API at: ${apiOrigin}`);

  const httpClient = axios.create({
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
      "X-Api-Token": apiToken,
    },
    baseURL: apiOrigin,
  });

  try {
    console.log("Fetching unfiltered fixtures snapshot...");
    const response = await httpClient.get<TxLineFixture[]>("/api/fixtures/snapshot");
    const fixtures = response.data;

    console.log(`\nSUCCESS: Retrieved ${fixtures.length} fixtures total.\n`);

    // Group by competition, tallying count + earliest/latest kickoff
    const byCompetition = new Map<number, { name: string; count: number; earliest: number; latest: number }>();

    for (const f of fixtures) {
      const existing = byCompetition.get(f.CompetitionId);
      if (existing) {
        existing.count++;
        existing.earliest = Math.min(existing.earliest, f.StartTime);
        existing.latest = Math.max(existing.latest, f.StartTime);
      } else {
        byCompetition.set(f.CompetitionId, {
          name: f.Competition,
          count: 1,
          earliest: f.StartTime,
          latest: f.StartTime,
        });
      }
    }

    // Sort by fixture count, descending — World Cup should float to the top
    const sorted = [...byCompetition.entries()].sort((a, b) => b[1].count - a[1].count);

    console.log(`Found ${sorted.length} unique competitions:\n`);
    console.log("CompetitionId | Fixtures | Date Range                          | Name");
    console.log("--------------|----------|-------------------------------------|------------------------------");

    for (const [id, info] of sorted) {
      const from = new Date(info.earliest).toISOString().slice(0, 10);
      const to = new Date(info.latest).toISOString().slice(0, 10);
      console.log(
        `${String(id).padEnd(13)} | ${String(info.count).padEnd(8)} | ${from} to ${to}`.padEnd(60) + ` | ${info.name}`
      );
    }

    console.log("\nLook for the row with ~104 fixtures and a name containing 'World Cup'.");
    console.log("Copy its CompetitionId into your config as WORLD_CUP_COMPETITION_ID.\n");
  } catch (error: any) {
    console.error("API Call Failed:");
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error("Data:", error.response.data);
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});