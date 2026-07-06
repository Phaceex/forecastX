import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const API_ORIGIN = "https://txline-dev.txodds.com";
const FIXTURE_ID = 18192996;

async function main() {
    const client = axios.create({
        baseURL: API_ORIGIN,
        headers: {
            Authorization: `Bearer ${process.env.GUEST_JWT}`,
            "X-Api-Token": process.env.API_TOKEN,
        },
    });

    const response = await client.get(`/api/scores/snapshot/${FIXTURE_ID}?asOf=${Date.now()}`);
    const data = response.data;

    // Sort chronologically by Seq
    const sortedData = [...data].sort((a: any, b: any) => a.Seq - b.Seq);

    console.log("LAST 20 CHRONOLOGICAL EVENTS:");
    sortedData.slice(-20).forEach((x: any) => {
        console.log({
            Seq: x.Seq,
            Action: x.Action,
            StatusId: x.StatusId,
            GameState: x.GameState,
            Clock: x.Clock,
            Score: x.Score ? {
                p1: x.Score.Participant1?.Total?.Goals,
                p2: x.Score.Participant2?.Total?.Goals
            } : undefined
        });
    });
}

main().catch((err) => console.error(err.response?.data || err.message));
