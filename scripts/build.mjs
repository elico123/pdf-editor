import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises'; // Added fs for file system operations

// Get __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const entryPoint = path.resolve(__dirname, '../js/app.js');
const distDir = path.resolve(__dirname, '../dist'); // Defined dist directory
const outfile = path.join(distDir, 'app.js'); // Output file will be in distDir
const versionFile = path.join(distDir, 'version.json'); // Path for version.json
const packageJsonPath = path.resolve(__dirname, '../package.json'); // Path to package.json

console.log('Entry point:', entryPoint);
console.log('Output file:', outfile);
console.log('Version file:', versionFile);

async function build() {
  try {
    // Create dist directory if it doesn't exist
    await fs.mkdir(distDir, { recursive: true });

    // Read package.json and extract version
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);
    const version = packageJson.version;

    // Create version.json
    await fs.writeFile(versionFile, JSON.stringify({ version }, null, 2));
    console.log(`Version ${version} written to ${versionFile}`);

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
