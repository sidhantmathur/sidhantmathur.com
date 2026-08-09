// Geist, self-hosted from the `geist` npm package rather than next/font/google.
//
// WHY NOT next/font/google: it fetches the font from Google at BUILD time. The
// runtime is identical either way — Next serves the file from our own origin in
// both cases, no visitor ever hits Google — but the build-time fetch makes
// `npm run build` fail in any sandbox whose egress allowlist doesn't include
// fonts.googleapis.com. Cloud dev environments are exactly that. Sourcing the
// same typeface from the npm registry, which is reachable anywhere `npm ci`
// works, makes the build network-independent.
//
// The package is Vercel's own and ships the variable font (100–900) in place of
// the four static weights we used to request, so this is also fewer bytes and
// every intermediate weight. Variable names are unchanged — `--font-geist-sans`
// and `--font-geist-mono`, consumed by app/globals.css — as is `display: swap`,
// which is next/font's default.
export { GeistSans as geistSans } from "geist/font/sans";
export { GeistMono as geistMono } from "geist/font/mono";
