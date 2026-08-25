import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Fotos de produto (products.image_url) são coladas por ADMIN como URL
    // hospedada externamente (Supabase Storage, CDN, etc.) — sem domínio fixo
    // conhecido de antemão, então liberamos qualquer host https. O campo só é
    // editável por quem já tem acesso ao cadastro de produtos (admin).
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
