import { Metadata } from "next";

export const templateMetadata: Metadata = {
  metadataBase: new URL("https://clerk-nextjs-app-router.vercel.app/"),
  title: "Matbu.app",
  description:
    "Publish your first book free",
  openGraph: { images: ["/og.png"] },
};

// Default metadata for when template is removed
export const defaultMetadata: Metadata = {
  title: "Matbu.app",
  description: "Publish your first book free",
};
