import dotenv from "dotenv";
dotenv.config();

const API_ORIGIN = "https://txline-dev.txodds.com";
const FIXTURE_ID = 18179549;

async function main() {
    const url = `${API_ORIGIN}/api/scores/stream?fixtureId=${FIXTURE_ID}`;
    const response = await fetch(url, {
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

    console.log("Streaming... (will exit after 3 events or 10 seconds)");

    let count = 0;
    const timeout = setTimeout(() => {
        console.log("Timeout reached.");
        process.exit(0);
    }, 10000);

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data:")) {
                const jsonStr = trimmed.slice(5).trim();
                try {
                    const payload = JSON.parse(jsonStr);
                    console.log("EVENT RECEIVED:", JSON.stringify(payload, null, 2));
                    count++;
                    if (count >= 3) {
                        clearTimeout(timeout);
                        return;
                    }
                } catch (e) {
                    console.log("Could not parse data line:", trimmed);
                }
            }
        }
    }
}

main().catch(console.error);
