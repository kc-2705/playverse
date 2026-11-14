import { theme, type ThemeConfig } from 'antd';

/** Playverse's dark game look, shared by the app and Storybook. */
export const playverseTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#ff8a3d',
    colorInfo: '#5aa9ff',
    colorBgBase: '#0e1222',
    colorBgContainer: '#151a2e',
    colorBgElevated: '#1b2138',
    colorBorder: '#2a3150',
    borderRadius: 12,
    fontFamily: "'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif",
    // Helper and error text bright enough for WCAG AA contrast (4.5:1) on dark panels.
    colorTextDescription: '#9aa3c2',
    colorError: '#ff7875',
  },
  components: {
    // Dark text on orange buttons: white on #ff8a3d is only 2.4:1, this is 7.9:1.
    Button: { fontWeight: 700, primaryColor: '#0e1222' },
    Statistic: { contentFontSize: 26 },
  },
};
