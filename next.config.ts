import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Apple Pay requires this exact well-known path for domain validation.
        // The actual file content is served dynamically from the APPLE_PAY_DOMAIN_ASSOCIATION_FILE env var.
        source: "/.well-known/apple-developer-merchantid-domain-association",
        destination: "/api/apple-pay-domain-association",
      },
    ];
  },
};

export default nextConfig;
