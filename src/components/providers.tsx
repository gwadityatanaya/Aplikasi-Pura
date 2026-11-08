"use client";
import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import { useStore } from "@/lib/store";
import { PwaRegister } from "@/components/pwa";
import { HelpButton } from "@/components/shared/help-button";
import { NoticeBar } from "@/components/shared/notice-bar";

export function Providers({ children }: { children: React.ReactNode }) {
  const prefs = useStore((s) => s.prefs);
  // The account's choice wins over the device's (so it follows the person to another HP).
  const accountSize = useStore((s) => s.me?.textSize);

  useEffect(() => {
    useStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    const size = accountSize ?? prefs.textSize;
    document.documentElement.classList.toggle("text-besar", size === "besar");
    document.documentElement.classList.toggle("text-sangat-besar", size === "sangat_besar");
    document.documentElement.classList.toggle("reduce-motion", prefs.reduceMotion);
  }, [accountSize, prefs.textSize, prefs.reduceMotion]);

  return (
    <MotionConfig reducedMotion={prefs.reduceMotion ? "always" : "user"}>
      {children}
      <HelpButton />
      <NoticeBar />
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
