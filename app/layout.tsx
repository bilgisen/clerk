import { ClerkProvider } from "@clerk/nextjs";
import type { Appearance } from "@clerk/types";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { headers } from "next/headers";
import { ErrorBoundary } from "@/components/error-boundary";
import { logError } from "@/lib/utils/error-handler";

export const metadata = {
  title: "Bookshall - Document Management System",
  description: "Your powerful document management system",
};

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
  const nonce = (await headers()).get("x-nonce") || "";

  return (
    <html lang="en" suppressHydrationWarning>
      <ClerkProvider appearance={clerkAppearance} nonce={nonce} dynamic>
        <body className="min-h-screen bg-background">
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <ErrorBoundary
              onError={(error, errorInfo) => {
                logError(error, {
                  componentStack: errorInfo?.componentStack,
                  pathname:
                    typeof window !== "undefined"
                      ? window.location.pathname
                      : undefined,
                });
              }}
              fallback={
                <div className="p-6 max-w-2xl mx-auto my-8 bg-red-50 border border-red-200 rounded-lg">
                  <h2 className="text-xl font-bold text-red-800 mb-4">
                    Something went wrong
                  </h2>
                  <p className="mb-4">
                    We're sorry, but an unexpected error occurred. Our team has
                    been notified.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  >
                    Reload Page
                  </button>
                </div>
              }
            >
              {children}
            </ErrorBoundary>
          </ThemeProvider>
        </body>
      </ClerkProvider>
    </html>
  );
}
