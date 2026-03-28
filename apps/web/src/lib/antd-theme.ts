import type { ThemeConfig } from "antd";

/**
 * Ant Design 테마 설정
 * design-system.css의 Amie 스타일을 Ant Design 토큰에 매핑합니다.
 *
 * CSS 변수는 런타임 값이라 Ant Design 토큰에 직접 사용 불가하므로,
 * 동일한 값을 하드코딩합니다. design-system.css와 동기화 필요.
 */
export const lightTheme: ThemeConfig = {
  cssVar: { prefix: "ant" },
  token: {
    // Colors
    colorPrimary: "#0284C7",
    colorBgContainer: "#FFFFFF",
    colorBgLayout: "#FFFFFF",
    colorBgElevated: "#F5F5F7",
    colorBgSpotlight: "#F5F5F7",
    colorText: "#1D1D1F",
    colorTextSecondary: "#6E6E73",
    colorTextTertiary: "#AEAEB2",
    colorBorder: "rgba(0, 0, 0, 0.06)",
    colorBorderSecondary: "rgba(0, 0, 0, 0.12)",
    colorSuccess: "#10B981",
    colorWarning: "#F59E0B",
    colorError: "#EC4899",
    colorInfo: "#3B82F6",

    // Border radius
    borderRadius: 10,
    borderRadiusLG: 12,
    borderRadiusSM: 8,
    borderRadiusXS: 4,

    // Typography
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
    fontSize: 14,

    // Motion
    motionDurationMid: "0.2s",
    motionEaseInOut: "cubic-bezier(0.22, 1, 0.36, 1)",

    // Shadows — Amie: minimal
    boxShadow: "none",
    boxShadowSecondary: "0 1px 2px rgba(0, 0, 0, 0.15)",
  },
  components: {
    Button: {
      borderRadius: 8,
      controlHeight: 36,
      fontSize: 13,
      fontWeight: 500,
    },
    Card: {
      borderRadiusLG: 12,
      boxShadow: "none",
    },
    Input: {
      borderRadius: 8,
    },
  },
};

export const darkTheme: ThemeConfig = {
  cssVar: { prefix: "ant" },
  token: {
    // Colors
    colorPrimary: "#0EA5E9",
    colorBgContainer: "#1C1C1E",
    colorBgLayout: "#141414",
    colorBgElevated: "#2C2C2E",
    colorBgSpotlight: "#1C1C1E",
    colorText: "#F5F5F7",
    colorTextSecondary: "#98989D",
    colorTextTertiary: "#636366",
    colorBorder: "rgba(255, 255, 255, 0.08)",
    colorBorderSecondary: "rgba(255, 255, 255, 0.14)",
    colorSuccess: "#34D399",
    colorWarning: "#FBBF24",
    colorError: "#F472B6",
    colorInfo: "#60A5FA",

    // Border radius — same as light
    borderRadius: 10,
    borderRadiusLG: 12,
    borderRadiusSM: 8,
    borderRadiusXS: 4,

    // Typography — same as light
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
    fontSize: 14,

    // Motion — same as light
    motionDurationMid: "0.2s",
    motionEaseInOut: "cubic-bezier(0.22, 1, 0.36, 1)",

    // Shadows
    boxShadow: "none",
    boxShadowSecondary: "0 1px 2px rgba(0, 0, 0, 0.3)",
  },
  components: {
    Button: {
      borderRadius: 8,
      controlHeight: 36,
      fontSize: 13,
      fontWeight: 500,
    },
    Card: {
      borderRadiusLG: 12,
      boxShadow: "none",
    },
    Input: {
      borderRadius: 8,
    },
  },
};
