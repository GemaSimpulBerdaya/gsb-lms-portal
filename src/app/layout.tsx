import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { DialogProvider } from "@/components/ui/DialogProvider";
import { ToastProvider } from "@/components/toast/ToastProvider";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "LMS Gema Simpul Berdaya",
  description: "Platform Learning Management System untuk Yayasan Gema Simpul Berdaya",
};

export const viewport: Viewport = {
  themeColor: "#f8fafc",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${dmSans.variable} h-full antialiased font-sans`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <DialogProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </DialogProvider>
      </body>
    </html>
  );
}
