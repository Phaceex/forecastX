import { useState, useEffect } from "react";
import type { Fixture } from "../config";
import { fetchAllWorldCupFixtures, toFixture } from "../lib/txline";

export function useFixtures(jwt: string | null, apiToken: string | null) {
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!jwt || !apiToken) return;
        fetchAllWorldCupFixtures(jwt, apiToken)
            .then((raw) => setFixtures(raw.map(toFixture) as Fixture[]))
            .finally(() => setLoading(false));
    }, [jwt, apiToken]);

    return { fixtures, loading };
}