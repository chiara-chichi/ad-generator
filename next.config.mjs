/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
    CREATOMATE_API_KEY: process.env.CREATOMATE_API_KEY,
  },
};

export default nextConfig;
