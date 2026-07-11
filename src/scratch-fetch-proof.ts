import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const apiOrigin = "https://txline-dev.txodds.com";
const jwt = process.env.VITE_TXLINE_JWT;
const apiToken = process.env.VITE_TXLINE_API_TOKEN;

async function main() {
    const client = axios.create({
        baseURL: apiOrigin,
        headers: {
            Authorization: `Bearer ${jwt}`,
            "X-Api-Token": apiToken,
        },
    });

    // 1. Fetch updates
    const res = await client.get("/api/scores/updates/18175918");
    const data = res.data;
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

    const finalised = list.find(x => x.Action === "game_finalised" || x.action === "game_finalised" || x.StatusId === 100 || x.statusId === 100) || list[list.length - 1];
    if (!finalised) {
        console.log("No updates found!");
        return;
    }

    const seq = finalised.Seq ?? finalised.seq;
    console.log("Found final seq:", seq, "at ts:", finalised.Ts);

    // 2. Fetch validation proof
    const valRes = await client.get("/api/scores/stat-validation", {
        params: {
            fixtureId: 18175918,
            seq: seq,
            statKey: 2,
        }
    });

    console.log("Successfully fetched validation proof!");
    console.log("Proof summary:", JSON.stringify(valRes.data.summary, null, 2));
    console.log("Proof statToProve:", JSON.stringify(valRes.data.statToProve, null, 2));
    console.log("Proof subTreeProof length:", valRes.data.subTreeProof?.length);
    console.log("Proof mainTreeProof length:", valRes.data.mainTreeProof?.length);
}

main().catch(err => console.error(err.response?.data || err.message));
