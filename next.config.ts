import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const withMDX = createMDX({
  // no remark/rehype plugins — GFM-less, plain MDX is enough for these three files
});

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
};

export default withMDX(nextConfig);
