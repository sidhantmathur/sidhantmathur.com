// Geist from the `geist` npm package rather than next/font/google, which
// fetches the font from Google at build time and so fails `npm run build` in
// any sandbox without egress to fonts.googleapis.com. Visitors see no
// difference: both serve the file from this origin.
//
// The package ships the variable font (100–900) and keeps the variable names
// app/globals.css reads, `--font-geist-sans` and `--font-geist-mono`.
export { GeistSans as geistSans } from "geist/font/sans";
export { GeistMono as geistMono } from "geist/font/mono";
