"use client";

import { ConfigProvider, theme as antdTheme } from "antd";
import { useEffect, useState, type ReactNode } from "react";
import { lightTheme, darkTheme } from "@/lib/antd-theme";

/**
 * Ant Design ConfigProvider wrapper.
 * prefers-color-scheme에 따라 light/dark 테마를 자동 전환합니다.
 */
export function AntdProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);

    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const themeConfig = isDark
    ? { ...darkTheme, algorithm: antdTheme.darkAlgorithm }
    : lightTheme;

  return <ConfigProvider theme={themeConfig}>{children}</ConfigProvider>;
}
