// js/pdfSetup.js
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import * as pdfLib from 'pdf-lib';

// Setup for PDF.js worker
if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    // The worker is copied to the 'dist' folder by the build script
    pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.mjs';
} else {
    console.error("pdfjsLib or GlobalWorkerOptions is not defined. This should not happen with direct imports.");
}

// Export the pdfjsLib itself to be used by app.js
export { pdfjsLib };

// Export PDFLib objects from the imported module
export const {
    PDFDocument,
    rgb,
    StandardFonts,
    TextAlignment,
    PDFName,
    PDFString,
    PDFHexString,
    grayscale,
} = pdfLib;
