import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const API_ORIGIN = "https://txline-dev.txodds.com";

async function streamScores() {
    const response = await fetch(`${API_ORIGIN}/api/odds/stream`, {
        headers: {
            Authorization: `Bearer ${process.env.GUEST_JWT}`,
            "X-Api-Token": process.env.API_TOKEN!,
            Accept: "text/event-stream",
        },
    });

    if (!response.ok || !response.body) {
        throw new Error(`Stream failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    console.log("Streaming... (Ctrl+C to stop)");

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            if (line.startsWith("data:")) {
                console.log(JSON.parse(line.slice(5).trim()));
            }
        }
    }
}

streamScores().catch(console.error);