import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

/**
 * GitHub Pages 部署在 `https://<user>.github.io/<repo>/` 子路径下，
 * 因此生产构建必须把 base 设置为 `/<repo>/`，否则所有资源会去请求域名根目录而 404。
 *
 * 优先级：
 *   1. 环境变量 BASE_PATH          —— 手动覆盖（例如部署到自定义域名时设为 `/`）
 *   2. CI 中的 GITHUB_REPOSITORY   —— 形如 `owner/repo`，自动取 repo 名
 *   3. 本地回退 REPO_NAME 常量     —— 本地 dev/预览时无需子路径
 */
const REPO_NAME = 'bhy-lite';
void REPO_NAME;
function resolveBase(): string {
  if (process.env.BASE_PATH) return withSlashes(process.env.BASE_PATH);
  const ghRepo = process.env.GITHUB_REPOSITORY; // owner/repo
  if (ghRepo && ghRepo.includes('/')) {
    return withSlashes(ghRepo.split('/')[1]);
  }
  // 本地开发 / vite preview：使用根路径
  return '/';
}

function withSlashes(p: string): string {
  return `/${p.replace(/^\/+|\/+$/g, '')}/`;
}

export default defineConfig({
  base: resolveBase(),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2020',
    // 产出的资源全部走相对/子路径 base，无需额外处理
  },
  server: {
    port: 5173,
    open: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
