import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

export function useAutoLogout() {
  const { session, signOut } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (session) {
      timerRef.current = setTimeout(() => {
        signOut();
      }, INACTIVITY_TIMEOUT);
    }
  }, [session, signOut]);

  useEffect(() => {
    if (!session) return;

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [session, resetTimer]);
}
