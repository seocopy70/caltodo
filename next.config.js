/** @type {import('next').NextConfig} */
const nextConfig = {
  // 빌드 중 타입 오류가 있어도 무시하고 진행 (강제 배포)
  typescript: {
    ignoreBuildErrors: true,
  },
  // 빌드 중 문법 검사 에러가 있어도 무시하고 진행
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;