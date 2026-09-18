import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Sheet → Pages",
  description: "Bulk-generate and deploy static sites from a spreadsheet",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}

