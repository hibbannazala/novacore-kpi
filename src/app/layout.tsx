import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "sonner";

const font = Plus_Jakarta_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NovaCore KPI",
  description: "Operational KPI Management System",
  icons: {
    icon: [
      { url: "/logos/logo-nova-core-app-512px.webp", sizes: "512x512", type: "image/webp" },
    ],
    apple: [
      { url: "/logos/logo-nova-core-app-1024px.webp", sizes: "1024x1024", type: "image/webp" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={`${font.className} bg-gradient-to-br from-[#E2F1F1] via-[#EAF4F4] to-[#E9E4F0] min-h-screen text-slate-800`}>
        <AuthProvider>{children}</AuthProvider>
        <Toaster richColors position="top-center" expand={true} />
      </body>
    </html>
  );
}
