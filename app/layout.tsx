import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Providers } from "@/providers/session-provider";

export const metadata = {
  title: "Bookshall - Document Management System",
  description: "Your powerful document management system",};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background">
        <Providers>
          <ThemeProvider 
            attribute="class" 
            defaultTheme="system" 
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
