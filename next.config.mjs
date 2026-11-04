
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // On Vercel each API route is bundled on its own.
  // These lines ensure the CV PDFs and Apply kit file
  // are included with the routes that read them.
  experimental: {
    outputFileTracingIncludes: {
      "/api/resume": ["./resumes/**/*"],
      "/api/approve": ["./resumes/**/*"],
      "/api/kit": ["./config/applyKit.json"],
    },
  },
};

export default nextConfig;
