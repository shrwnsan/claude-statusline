import esbuild from 'esbuild';
import { builtinModules } from 'module';
import { writeFileSync } from 'fs';

// Configuration for optimized bundling
const config = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: ['node18'],
  format: 'esm',
  minify: false, // Keep readable for debugging, enable for production
  sourcemap: true,
  treeShaking: true,
  external: [
    // Node.js built-in modules
    ...builtinModules,
    // Keep dependencies external to avoid bundling issues
    'yaml',
    'zod',
  ],
  outfile: 'dist/index.bundle.js',
  metafile: true,
  // Define constants for build-time optimization
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  // Optimizations for fast startup
  splitting: false, // Single file bundle for fastest loading
  chunkNames: '[name]-[hash]',
  // Keep the bundle size reasonable
  assetNames: '[name]-[hash]',
  // Don't bundle these - they'll be resolved at runtime
  packages: 'external',
};

// Build function
async function build() {
  try {
    console.log('📦 Building optimized bundle with esbuild...');
    const result = await esbuild.build(config);

    if (result.errors.length > 0) {
      console.error('❌ Build errors:');
      result.errors.forEach(error => console.error(error));
      process.exit(1);
    }

    if (result.warnings.length > 0) {
      console.warn('⚠️ Build warnings:');
      result.warnings.forEach(warning => console.warn(warning));
    }

    console.log('✅ Bundle created successfully!');

    // Write metafile for analysis
    if (result.metafile) {
      writeFileSync('dist/metafile.json', JSON.stringify(result.metafile, null, 2));
      console.log('📊 Bundle analysis saved to dist/metafile.json');

      // Analyze bundle size
      const bundleSize = result.metafile.outputs['dist/index.bundle.js'].bytes;
      console.log(`📏 Bundle size: ${(bundleSize / 1024).toFixed(2)} KB`);
    }

    return result;
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run build if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  build();
}

export { build, config };