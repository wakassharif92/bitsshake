import "@/styles/globals.css";
import type { AppProps } from "next/app";
import DevelopmentBanner from "@/components/DevelopmentBanner";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <DevelopmentBanner />
      <Component {...pageProps} />
    </>
  );
}
