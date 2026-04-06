import { useEffect, useRef, useState, useCallback } from "react";

interface JobEvent {
  type: string;
  requirement_id?: string;
  status?: string;
  progress?: number;
  candidate?: unknown;
  error?: string;
}

export function useJobStream(jobId: string | null) {
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) return;
    const source = new EventSource(`/api/jobs/${jobId}/stream`);
    sourceRef.current = source;
    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as JobEvent;
      setEvents((prev) => [...prev, data]);
      if (data.type === "done") {
        setIsComplete(true);
        source.close();
      }
    };
    source.onerror = () => {
      setIsComplete(true);
      source.close();
    };
    return () => {
      source.close();
    };
  }, [jobId]);

  const reset = useCallback(() => {
    setEvents([]);
    setIsComplete(false);
  }, []);

  return { events, isComplete, reset };
}
