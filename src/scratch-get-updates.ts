import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const apiOrigin = "https://txline-dev.txodds.com";
const jwt = process.env.VITE_TXLINE_JWT;
const apiToken = process.env.VITE_TXLINE_API_TOKEN;

async function main() {
    console.log("JWT length:", jwt?.length);
    console.log("API Token:", apiToken);

    const client = axios.create({
        baseURL: apiOrigin,
        headers: {
            Authorization: `Bearer ${jwt}`,
            "X-Api-Token": apiToken,
        },
    });

    const res = await client.get("/api/scores/updates/18175918");
    const data = res.data;
    console.log("Type of data:", typeof data);
    if (typeof data === "string") {
        console.log("String preview:", data.slice(0, 1000));
        // Parse line by line to see updates
        const list = [];
        const lines = data.split("\n");
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data:")) {
                try {
                    const parsed = JSON.parse(trimmed.slice(5).trim());
                    list.push(parsed);
                } catch (e) {}
            }
        }
        console.log("Parsed lines count:", list.length);
        if (list.length > 0) {
            console.log("First parsed update:", JSON.stringify(list[0], null, 2));
            console.log("Last parsed update:", JSON.stringify(list[list.length - 1], null, 2));
        }
    } else {
        console.log("Array length:", data.length);
        console.log("First element:", JSON.stringify(data[0], null, 2));
        console.log("Last element:", JSON.stringify(data[data.length - 1], null, 2));
    }
}

main().catch(err => console.error(err.response?.data || err.message));
