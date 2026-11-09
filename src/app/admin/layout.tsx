import "./admin.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Kudi Store — The control room",
  robots: { index: false, follow: false },
};
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
