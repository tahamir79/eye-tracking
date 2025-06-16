/** @type {import('next').NextConfig} */
const config = {
  // ⬇– ignore type-checking errors during `next build`
  typescript: { ignoreBuildErrors: true },

  // ⬇– skip ESLint during `next build`
  eslint: { ignoreDuringBuilds: true },
};

module.exports = config;   // ← CommonJS export (no “export default”)
