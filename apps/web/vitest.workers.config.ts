import { defineConfig } from 'vitest/config'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'

export default defineConfig(async () => {
  const migrations = await readD1Migrations('./drizzle')
  return {
    plugins: [
      cloudflareTest({
        miniflare: {
          compatibilityDate: '2026-08-15',
          d1Databases: { DB: 'tomny-coffee-test' },
        },
      }),
    ],
    define: { __D1_MIGRATIONS__: JSON.stringify(migrations) },
    test: { include: ['src/**/*.integration.test.ts'] },
  }
})