import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { PwaRegistration } from "./components/PwaRegistration";
import "./globals.css";

const description =
  "Request vehicle servicing, diagnostics or a dyno tune with PSI Performance Garage in Pakenham, Victoria.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host") || "psiperformance.com.au";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const socialImage = new URL("/og.png", origin).toString();

  return {
    metadataBase: new URL(origin),
    title: {
      default: "PSI Performance Booking",
      template: "%s | PSI Performance",
    },
    description,
    applicationName: "PSI Performance",
    keywords: [
      "PSI Performance",
      "Pakenham mechanic",
      "dyno tuning Pakenham",
      "performance car service",
      "vehicle servicing",
    ],
    manifest: "/manifest.webmanifest",
    icons: {
      icon: "/psi-favicon.png",
      shortcut: "/psi-favicon.png",
      apple: "/psi-icon-192.png",
    },
    openGraph: {
      type: "website",
      locale: "en_AU",
      url: origin,
      siteName: "PSI Performance",
      title: "Book your car | PSI Performance",
      description,
      images: [{ url: socialImage, width: 1730, height: 909, alt: "Book your car with PSI Performance" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Book your car | PSI Performance",
      description,
      images: [socialImage],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080808",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
