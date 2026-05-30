/**
 * Client-side auth helpers.
 *
 * The JWT lives in localStorage. We accept the XSS tradeoff for the demo;
 * production should move to httpOnly cookies and CSRF tokens.
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, setToken, type UserResponse, ApiError } from "@/lib/api";

export function useUser() {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          setToken(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = () => {
    setToken(null);
    setUser(null);
    router.push("/login");
  };

  return { user, loading, logout };
}

export function useRequireAuth() {
  const router = useRouter();
  const { user, loading } = useUser();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  return { user, loading };
}
