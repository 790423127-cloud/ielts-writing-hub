import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./migration.css";

export const metadata: Metadata = {
  title: "IELTS Writing Studio",
  description: "用户自带题目的 IELTS Academic 与 General Training 写作评分工作台"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111936"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
