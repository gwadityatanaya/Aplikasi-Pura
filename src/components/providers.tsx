"use client";
import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import { useStore } from "@/lib/store";
import { PwaRegister } from "@/components/pwa";

export function Providers({ children }: { children: React.ReactNode }) {
  const prefs = useStore((s) => s.prefs);

  useEffect(() => {
    useStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("text-large", prefs.textSize === "large");
    document.documentElement.classList.toggle("reduce-motion", prefs.reduceMotion);
  }, [prefs.textSize, prefs.reduceMotion]);

  return (
    <MotionConfig reducedMotion={prefs.reduceMotion ? "always" : "user"}>
      {children}
      <PwaRegister />
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{ style: { fontFamily: "inherit", fontSize: 15, borderRadius: 16 } }}
      />
    </MotionConfig>
  );
}
