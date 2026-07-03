import axios from "axios";
import * as path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const API_ORIGIN = "https://txline-dev.txodds.com";
const FIXTURE_ID = 18179550; // USA vs Bosnia & Herzegovina, from your snapshot

async function main() {
    const client = axios.create({
        baseURL: API_ORIGIN,
        headers: {
            Authorization: `Bearer ${process.env.GUEST_JWT}`,
            "X-Api-Token": process.env.API_TOKEN,
        },
    });

    const response = await client.get(`/api/scores/snapshot/${FIXTURE_ID}?asOf=${Date.now()}`);
    console.log(JSON.stringify(response.data, null, 2));
}

main().catch((err) => console.error(err.response?.data || err.message));