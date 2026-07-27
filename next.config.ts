import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const withMDX = createMDX({
  // no remark/rehype plugins — GFM-less, plain MDX is enough for these three files
});

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  async redirects() {
    return [
      // /chat was the standalone conversation page. The homepage is now the
      // conversation, so the route is permanently folded into it. ?q= is
      // dropped: nothing links to it externally, and the shell has no
      // auto-send-on-load path.
      { source: "/chat", destination: "/", permanent: true },
      // The prototype route. Kept as a redirect for a while because it was
      // shared locally during the redesign.
      { source: "/lab", destination: "/", permanent: false },
    ];
  },
};

export default withMDX(nextConfig);
