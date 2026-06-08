/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/signup',
        destination: '/auth/signup/candidate', // Ya fir jahan aap default phekna chahein
        permanent: true,
      },
      {
        source: '/login',
        destination: '/auth/login/candidate',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;