import { defineConfig } from 'tsdown/config'

export default defineConfig({
  entry: 'src/main.ts',
  format: 'esm',
  target: 'es2022',
  platform: 'node',
  outDir: 'dist',
  sourcemap: true,
})