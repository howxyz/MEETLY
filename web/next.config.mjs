// Static export: `npm run build` writes plain HTML/JS to ./out, and FastAPI serves it.
// No Node server is needed in production or on Colab.
const preview = process.env.NEXT_PUBLIC_PREVIEW === "1";   // the shareable preview (artifact) uses relative paths

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: false,
  ...(preview ? { assetPrefix: "." } : {}),
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
