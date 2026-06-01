import type { Metadata } from "next";
import { Montserrat, Open_Sans } from "next/font/google";
import { DialogProvider } from "@/components/ui/DialogProvider";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-heading",
  subsets: ["latin"],
});

const openSans = Open_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LMS Gema Simpul Berdaya",
  description: "Platform Learning Management System untuk Yayasan Gema Simpul Berdaya",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${montserrat.variable} ${openSans.variable} h-full antialiased font-sans`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <DialogProvider>
          {children}
        </DialogProvider>
      </body>
    </html>
  );
}
