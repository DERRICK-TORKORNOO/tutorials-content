import type { Metadata, Viewport } from "next";
import "./globals.css";
import { OfflineSetup } from "@/components/offline-setup";
export const metadata: Metadata = {
  title: "Kudi Store — Good things. Everyday.",
  description:
    "Considered essentials for your everyday. Discover sneakers, audio, bags and watches at Kudi Store.",
  manifest: "/manifest.json",
};
export const viewport: Viewport = { themeColor: "#335844" };
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <OfflineSetup>{children}</OfflineSetup>
      </body>
    </html>
  );
}
