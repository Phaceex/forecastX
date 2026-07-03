import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const CONFIG = {
  mainnet: {
    apiOrigin: "https://txline.txodds.com",
  },
  devnet: {
    apiOrigin: "https://txline-dev.txodds.com",
  },
} as const;

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
  console.log(`Using API Token: ${apiToken}`);

  const httpClient = axios.create({
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwt}`,
      "X-Api-Token": apiToken,
    },
    baseURL: apiOrigin,
  });

  try {
    console.log("Fetching fixtures snapshot...");
    const response = await httpClient.get("/api/fixtures/snapshot");
    const fixtures = response.data;

    console.log("\n==================================================");
    console.log(`SUCCESS: Retrieved ${fixtures.length} fixtures!`);
    console.log("==================================================\n");

    if (fixtures.length === 0) {
      console.log("No fixtures returned. This might be because there are no upcoming scheduled matches in this tier right now.");
      return;
    }

    // Inspect unique competitions
    const competitions = new Map<number, string>();
    fixtures.forEach((f: any) => {
      if (f.CompetitionId) {
        competitions.set(f.CompetitionId, f.CompetitionName || `Competition ${f.CompetitionId}`);
      }
    });

    console.log(`Found ${competitions.size} unique competitions in the dataset:`);
    competitions.forEach((name, id) => {
      console.log(`- ID ${id}: ${name}`);
    });
    console.log("");

    console.log("Sample Fixtures (up to 5):");
    fixtures.slice(0, 5).forEach((fixture: any, index: number) => {
      const homeTeam = fixture.Participant1IsHome ? fixture.Participant1 : fixture.Participant2;
      const awayTeam = fixture.Participant1IsHome ? fixture.Participant2 : fixture.Participant1;
      
      console.log(`${index + 1}. [${fixture.CompetitionName || `Comp ${fixture.CompetitionId}`}]`);
      console.log(`   ${homeTeam} vs ${awayTeam}`);
      console.log(`   Fixture ID: ${fixture.FixtureId}`);
      console.log(`   Start Time: ${fixture.StartTime ? new Date(fixture.StartTime).toISOString() : "N/A"}`);
      console.log("--------------------------------------------------");
    });

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
