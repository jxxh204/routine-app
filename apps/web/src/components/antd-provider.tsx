"use client";

import { ConfigProvider, theme as antdTheme } from "antd";
import { useSyncExternalStore, type ReactNode } from "react";
import { lightTheme, darkTheme } from "@/lib/antd-theme";

function subscribeDarkMode(callback: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getServerSnapshot() {
  return false;
}

/**
 * Ant Design ConfigProvider wrapper.
 * prefers-color-scheme에 따라 light/dark 테마를 자동 전환합니다.
 */
export function AntdProvider({ children }: { children: ReactNode }) {
  const isDark = useSyncExternalStore(subscribeDarkMode, getSnapshot, getServerSnapshot);

  const themeConfig = isDark
    ? { ...darkTheme, algorithm: antdTheme.darkAlgorithm }
    : lightTheme;

  return <ConfigProvider theme={themeConfig}>{children}</ConfigProvider>;
}
