import * as esbuild from 'esbuild';

try {
  await esbuild.build({
    entryPoints: [
      'src/lib/keyword-registry.ts',
      'src/lib/mode-state.ts',
      'src/lib/mode-config.ts',
    ],
    platform: 'node',
    format: 'cjs',
    outdir: 'dist/lib',
    bundle: true,
    target: 'node18',
    external: ['fs', 'path', 'os'],
    sourcemap: false,
  });
  console.log('Build complete: dist/lib/');
} catch (err) {
  console.error('Build failed:', err);
  process.exit(1);
}
