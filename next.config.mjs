/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'narrative-broadcast.vercel.app' }],
        destination: 'https://narrative-broadcast.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
