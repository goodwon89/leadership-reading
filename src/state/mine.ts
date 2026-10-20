import { useMemo } from "react";
import { useAuth } from "./auth";
import { loadMine } from "../lib/data";
import { Tracker } from "../lib/metrics";
import { useAsync } from "../components/ui";

export function useMine() {
  const { me } = useAuth();
  const q = useAsync(() => loadMine(me!), [me?.id]);
  const tracker = useMemo(() => (q.data ? new Tracker(q.data) : null), [q.data]);
  return { ...q, tracker, group: q.data?.group ?? null };
}
