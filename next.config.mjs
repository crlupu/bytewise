/** @type {import('next').NextConfig} */
const repoName = "bytewise";
const isPages = process.env.GITHUB_PAGES === "true";

// A static export: Bytewise has no server. Lessons are read and validated
// at build time, and progress lives in the browser.
const nextConfig = {
  output: "export",
  // Emit course/x/index.html rather than course/x.html, so a direct visit or
  // a refresh resolves on any static host.
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: isPages ? `/${repoName}` : "",
  assetPrefix: isPages ? `/${repoName}/` : "",
  env: { NEXT_PUBLIC_BASE_PATH: isPages ? `/${repoName}` : "" },
};
export default nextConfig;
