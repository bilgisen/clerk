import { ClerkProvider } from "@clerk/nextjs";
import type { Appearance } from "@clerk/types";
import "./globals.css";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { headers } from 'next/headers';

export const metadata = {
  title: "Bookshall - Document Management System",
  description: "Your powerful document management system",
};

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});

const clerkAppearance = {
  variables: { colorPrimary: "#000000" },
  elements: {
    formButtonPrimary: "bg-black hover:bg-gray-800",
    footerActionLink: "text-black hover:text-gray-800",
  },
} satisfies Appearance;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get the nonce from headers in a way that works with Next.js 13+
  const nonce = (await headers()).get('x-nonce') || '';
  
  return (
    <html lang="en" className={geistSans.variable} suppressHydrationWarning>
      <ClerkProvider 
        appearance={clerkAppearance}
        nonce={nonce}
        dynamic
      >
        <body className="min-h-screen bg-background">
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </body>
      </ClerkProvider>
    </html>
  );
}
