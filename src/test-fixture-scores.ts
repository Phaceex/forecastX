import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const API_ORIGIN = "https://txline-dev.txodds.com";

const FIXTURE_ID = process.argv[2] ? Number(process.argv[2]) : 18179549; // pass a fixture ID as an arg, or edit this default

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