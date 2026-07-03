import axios from "axios";
import * as path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const API_ORIGIN = "https://txline-dev.txodds.com";

async function main() {
    const client = axios.create({
        baseURL: API_ORIGIN,
        headers: {
            Authorization: `Bearer ${process.env.GUEST_JWT}`,
            "X-Api-Token": process.env.API_TOKEN,
        },
    });

    const response = await client.get("/api/scores/stat-validation", {
        params: {
            fixtureId: 18179550,
            seq: 698,
            statKey: 2, // Participant2 Total Goals
        },
    });

    const v = response.data;
    console.log("Top-level keys:", Object.keys(v));
    console.log("Summary keys:", Object.keys(v.summary));
    console.log("updateStats keys:", Object.keys(v.summary.updateStats));
    console.log("statToProve:", v.statToProve);
    console.log("eventStatRoot:", v.eventStatRoot);
    console.log("statProof:", v.statProof);
}

main().catch((err) => console.error(err.response?.data || err.message));