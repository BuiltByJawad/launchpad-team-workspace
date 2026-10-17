import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LaunchPad — Product workspace",
  description: "A clear, calm workspace for teams to plan work and keep projects moving.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
