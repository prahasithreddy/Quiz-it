import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  serverExternalPackages: ["pdf-parse"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ignore canvas and other browser-specific modules on server
      config.externals = config.externals || [];
      config.externals.push({
        canvas: 'canvas',
      });
    }
    
    return config;
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-XSS-Protection", value: "1; mode=block" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
      ],
    },
  ],
};

export default nextConfig;