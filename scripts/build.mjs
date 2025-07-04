import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { execSync } from 'child_process'; // For running tailwindcss CLI

// Get __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const entryPoint = path.resolve(projectRoot, 'js/app.js');
const distDir = path.resolve(projectRoot, 'dist');
const outfile = path.join(distDir, 'app.js');
const versionFile = path.join(distDir, 'version.json');
const packageJsonPath = path.resolve(projectRoot, 'package.json');
// const tailwindInputCss = path.resolve(projectRoot, 'css/tailwind.css'); // Removed
// const tailwindOutputCss = path.join(distDir, 'tailwind.css'); // Removed
const pdfWorkerSource = path.resolve(projectRoot, 'node_modules/pdfjs-dist/build/pdf.worker.mjs');
const pdfWorkerDest = path.join(distDir, 'pdf.worker.mjs');


console.log('Entry point:', entryPoint);
console.log('Output file:', outfile);
console.log('Version file:', versionFile);
// console.log('Tailwind input CSS:', tailwindInputCss); // Removed
// console.log('Tailwind output CSS:', tailwindOutputCss); // Removed
console.log('PDF.js worker source:', pdfWorkerSource);
console.log('PDF.js worker destination:', pdfWorkerDest);


async function build() {
  try {
    // Create dist directory if it doesn't exist
    await fs.mkdir(distDir, { recursive: true });

    // Tailwind CSS build step removed

    // 1. Copy PDF.js worker (was 2)
    console.log(`Copying PDF.js worker from ${pdfWorkerSource} to ${pdfWorkerDest}`);
    try {
        await fs.copyFile(pdfWorkerSource, pdfWorkerDest);
        console.log('PDF.js worker copied successfully.');
    } catch (copyError) {
        console.error('Failed to copy PDF.js worker:', copyError);
        // Decide if this is a fatal error. For now, let's assume it is.
        process.exit(1);
    }

    // 2. Create version.json (was 3)
    let version;
    const commitSha = process.env.COMMIT_SHA;

    if (commitSha && commitSha.trim() !== '') {
      version = commitSha.trim();
      console.log(`Using commit SHA for version: ${version}`);
    } else {
      // Read package.json and extract version for fallback
      console.log('COMMIT_SHA not found or empty, falling back to package.json version.');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);
      const packageVersion = packageJson.version;
      version = `dev-${packageVersion}`;
      console.log(`Using package.json version prefixed with 'dev-': ${version}`);
    }

    await fs.writeFile(versionFile, JSON.stringify({ version }, null, 2));
    console.log(`Version data written to ${versionFile}`);

    // 3. Build JavaScript with esbuild (was 4)
    console.log('Building JavaScript with esbuild...');
    await esbuild.build({
      entryPoints: [entryPoint],
      outfile,
      bundle: true,
      // esbuild automatically resolves node_modules, so explicit loader for .js from node_modules is not typically needed
      // However, if specific loaders were required for certain file types within node_modules, they would be added here.
      // For pdf.worker.js, we are copying it directly and will adjust the path in pdfSetup.js
    });
    console.log('esbuild JavaScript build successful!');
    console.log('Full build process successful!');
  } catch (e) {
    console.error('Build failed:', e);
    process.exit(1);
  }
}

build();
