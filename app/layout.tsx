import type { Metadata } from "next";
import "./globals.css";
import "./dashboard.css";
import "./landing.css";

export const metadata: Metadata = {
  title: "WalletNest — Cross-Wallet Asset Tracker",
  description:
    "Aggregate token balances, NFTs, and transactions across multiple wallets.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
