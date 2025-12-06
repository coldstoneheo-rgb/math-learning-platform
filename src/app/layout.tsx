import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "수학 학습 분석 플랫폼",
  description: "데이터 기반 개인 맞춤형 수학 학습 컨설팅 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
