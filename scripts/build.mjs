import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const entryPoint = path.resolve(__dirname, '../js/app.js');
const outfile = path.resolve(__dirname, '../dist/app.js');

console.log('Entry point:', entryPoint);
console.log('Output file:', outfile);

async function build() {
  try {
    await esbuild.build({
      entryPoints: [entryPoint],
      outfile,
      bundle: true,
    });
    console.log('Build successful!');
  } catch (e) {
    console.error('Build failed:', e);
    process.exit(1);
  }
}

build();
