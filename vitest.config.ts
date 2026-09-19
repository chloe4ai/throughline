import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/** Tests run against source, not build output, so a red test is never stale. */
const alias = (name: string) => ({
  find: `@throughline/${name}`,
  replacement: fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url)),
})

export default defineConfig({
  resolve: { alias: ['domain', 'billing', 'adherence', 'documentation'].map(alias) },
  test: { include: ['packages/**/test/**/*.test.ts'], environment: 'node' },
})
