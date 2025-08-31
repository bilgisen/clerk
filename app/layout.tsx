import type { Appearance } from "@clerk/types";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { headers } from "next/headers";
import { ClerkProvider } from "@/components/providers/clerk-provider";

export const metadata = {
  title: "Bookshall - Document Management System",
  description: "Your powerful document management system",
};

// Safe Clerk appearance configuration with defaults
// Debug function to safely access nested properties
const safeGet = (obj: any, path: string, defaultValue: any = undefined) => {
  try {
    const result = path.split('.').reduce((o, p) => o && o[p], obj);
    return result === undefined ? defaultValue : result;
  } catch (e) {
    console.error(`Error accessing ${path}:`, e);
    return defaultValue;
  }
};

const getClerkAppearance = (): Appearance => {
  try {
    const appearance: Appearance = {
      variables: {
        colorPrimary: "#000000",
        colorBackground: "#ffffff",
        colorText: "#000000",
        colorInputBackground: "#ffffff",
        colorInputText: "#000000",
      },
      elements: {
        formButtonPrimary: "bg-black hover:bg-gray-800 text-white",
        footerActionLink: "text-black hover:text-gray-800",
        card: "shadow-lg rounded-lg",
        headerTitle: "text-black",
        headerSubtitle: "text-gray-600",
      },
    };

    // Debug log for appearance object
    console.debug('Clerk appearance config:', {
      hasVariables: !!appearance.variables,
      hasElements: !!appearance.elements,
      // Log first level properties
      variableKeys: Object.keys(appearance.variables || {}),
      elementKeys: Object.keys(appearance.elements || {})
    });

    return appearance;
  } catch (error) {
    console.error("Error in Clerk appearance config:", {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      message: "Falling back to default appearance"
    });
    
    // Return a minimal valid appearance object
    return {
      variables: {
        colorPrimary: "#000000",
        colorBackground: "#ffffff",
        colorText: "#000000"
      },
      elements: {}
    };
  }
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") || "";

  // Wrap Clerk initialization in try/catch with detailed logging
  let clerkAppearance;
  try {
    clerkAppearance = getClerkAppearance();
    
    // Debug log for Clerk configuration
    console.debug('Clerk initialization:', {
      hasPublishableKey: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      appearanceType: typeof clerkAppearance,
      appearanceKeys: Object.keys(clerkAppearance || {}),
      isServer: typeof window === 'undefined'
    });
  } catch (error) {
    console.error('Failed to initialize Clerk:', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      envVars: {
        hasPublishableKey: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        clerkDomain: process.env.NEXT_PUBLIC_CLERK_DOMAIN,
        nodeEnv: process.env.NODE_ENV,
      }
    });
    // Fallback to minimal appearance
    clerkAppearance = {};
  }
  
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background">
        <ClerkProvider appearance={clerkAppearance} nonce={nonce}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
