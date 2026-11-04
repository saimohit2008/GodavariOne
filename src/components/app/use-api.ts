"use client";
import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";

// Simple data-fetching hook with manual refetch.
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<T>(path);
      setData(res);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Request failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
     
  }, [path]);

  useEffect(() => {
    refetch();
     
  }, deps);

  return { data, loading, error, refetch, setData };
}

export function useToastHelpers() {
  return {
    success: (msg: string) => toast({ title: "Success", description: msg }),
    error: (msg: string) => toast({ title: "Error", description: msg, variant: "destructive" }),
  };
}
