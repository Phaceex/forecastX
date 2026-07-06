import axios from "axios";
import * as dotenv from "dotenv";
dotenv.config();

const jwt = process.env.GUEST_JWT;
const apiToken = process.env.API_TOKEN;

async function main() {
    if (!jwt || !apiToken) {
        console.error("JWT or API_TOKEN not set");
        return;
    }
    const httpClient = axios.create({
        baseURL: "https://txline-dev.txodds.com",
        headers: {
            Authorization: `Bearer ${jwt}`,
            "X-Api-Token": apiToken,
        }
    });

    // 1. Get fixtures
    const fixRes = await httpClient.get("/api/fixtures/snapshot", {
        params: { competitionId: 72 }
    });
    const fixtures = fixRes.data;
    if (fixtures.length === 0) return;

    for (const fixture of fixtures) {
        console.log(`Checking fixture: ${fixture.Participant1} vs ${fixture.Participant2} (ID: ${fixture.FixtureId})`);
        const oddsRes = await httpClient.get(`/api/odds/updates/${fixture.FixtureId}`);
        const odds = oddsRes.data;

        // Check 1X2 and OVERUNDER
        const nanUpdates = odds.filter((u: any) => {
            if (!u.PriceNames || !u.Prices) return true;
            for (let i = 0; i < u.PriceNames.length; i++) {
                const rawPrice = u.Prices[i];
                if (rawPrice === undefined || rawPrice === null) return true;
                const price = rawPrice / 1000;
                if (isNaN(price)) return true;
                const pctVal = u.Pct ? u.Pct[i] : undefined;
                const probability = pctVal && pctVal !== 'NA' ? Number(pctVal) : (1 / price) * 100;
                if (isNaN(probability)) return true;
            }
            return false;
        });

        console.log(`Found ${nanUpdates.length} updates causing NaN out of ${odds.length}`);
        if (nanUpdates.length > 0) {
            console.log("Sample NaN updates:");
            for (const u of nanUpdates.slice(0, 5)) {
                console.log({
                    SuperOddsType: u.SuperOddsType,
                    MarketParameters: u.MarketParameters,
                    PriceNames: u.PriceNames,
                    Prices: u.Prices,
                    Pct: u.Pct
                });
            }
        }
        console.log("=========================================");
    }
}

main().catch(console.error);
