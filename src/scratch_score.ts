import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const API_ORIGIN = "https://txline-dev.txodds.com";
const FIXTURE_ID = 18179549;

async function main() {
    const client = axios.create({
        baseURL: API_ORIGIN,
        headers: {
            Authorization: `Bearer ${process.env.GUEST_JWT}`,
            "X-Api-Token": process.env.API_TOKEN,
        },
    });

    const response = await client.get(`/api/scores/updates/${FIXTURE_ID}`);
    const dataStr: string = response.data;
    const lines = dataStr.split("\n");

    let totalParsed = 0;
    let scoreKeysFound = new Set<string>();
    let samples: any[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data:")) {
            try {
                const obj = JSON.parse(trimmed.slice(5).trim());
                totalParsed++;
                for (const k of Object.keys(obj)) {
                    if (k.toLowerCase().includes("score")) {
                        scoreKeysFound.add(k);
                        if (samples.length < 5) {
                            samples.push({ key: k, value: obj[k], action: obj.Action, gameState: obj.GameState });
                        }
                    }
                }
            } catch (e) {}
        }
    }

    console.log("Total parsed events from stream:", totalParsed);
    console.log("Score keys found (case-insensitive):", Array.from(scoreKeysFound));
    console.log("Samples:", JSON.stringify(samples, null, 2));
}

main().catch((err) => console.error(err.response?.data || err.message));
