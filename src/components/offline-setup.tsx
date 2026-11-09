"use client";
import { useEffect, useState } from "react";
export function OfflineSetup({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;
    let active = true;
    async function register() {
      try {
        if (active) setStatus("Saving the shop for offline use…");
        const registration = await navigator.serviceWorker.register("/sw.js", {
          updateViaCache: "none",
        });
        const worker = registration.installing ?? registration.waiting;
        if (worker)
          await new Promise<void>((resolve, reject) => {
            const check = () => {
              if (worker.state === "activated") resolve();
              else if (worker.state === "redundant")
                reject(new Error("Installation failed"));
            };
            worker.addEventListener("statechange", check);
            check();
          });
        await navigator.serviceWorker.ready;
        if (active) setStatus("Offline ready · the whole catalog is saved");
      } catch {
        if (active)
          setStatus(
            !navigator.onLine && navigator.serviceWorker.controller
              ? "Offline · browsing the saved shop"
              : "Offline setup failed. Reload while online to retry.",
          );
      }
    }
    void register();
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      {children}
      {status && (
        <div className="cache-status" role="status">
          {status}
        </div>
      )}
    </>
  );
}
