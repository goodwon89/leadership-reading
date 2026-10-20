import { useMemo } from "react";
import { loadDataset } from "../../lib/data";
import { Tracker } from "../../lib/metrics";
import { useAsync } from "../../components/ui";

export function useHqData() {
  const q = useAsync(() => loadDataset(null), []);
  const tracker = useMemo(() => (q.data ? new Tracker(q.data) : null), [q.data]);
  return { ...q, tracker };
}
