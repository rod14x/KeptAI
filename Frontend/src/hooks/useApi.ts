import { useEffect, useState, useSyncExternalStore } from "react";
import { getVersion, subscribe } from "../api/events";

type ApiState<T> = { data: T | undefined; loading: boolean; error: Error | null; reload: () => void };

/** Carga asíncrona que se refresca cuando cambia el store o las dependencias. */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[]): ApiState<T> {
  const version = useSyncExternalStore(subscribe, getVersion);
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetcher()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e : new Error("Error inesperado")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, nonce, ...deps]);

  return { data, loading: loading && data === undefined, error, reload: () => setNonce((n) => n + 1) };
}
