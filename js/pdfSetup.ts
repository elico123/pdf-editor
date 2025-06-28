// js/pdfSetup.ts

// It's better to import types from 'pdf-lib' if you install it as a dependency.
// For now, assuming global PDFLib and pdfjsLib and using 'any' for simplicity.
// Ideally: import { PDFDocument as PDFLibDocument, rgb as pdfLibRgb, StandardFonts as PdfLibStandardFonts, ... } from 'pdf-lib';

declare global {
    interface Window {
        pdfjsLib?: any; // Replace 'any' with actual pdfjsLib types if available
        PDFLib?: any;   // Replace 'any' with actual PDFLib types if available
        showSaveFilePicker?: (options?: any) => Promise<any>; // File System Access API
    }
}

// Setup for PDF.js worker
if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;
} else {
    console.error("pdfjsLib or GlobalWorkerOptions is not defined. Ensure PDF.js library is loaded.");
}

// Destructure and export PDFLib objects
// Using 'any' for these types. For stronger typing, import types from 'pdf-lib'
let PDFDocument: any,
    rgb: any,
    StandardFonts: any,
    TextAlignment: any,
    PDFName: any,
    PDFString: any,
    PDFHexString: any,
    grayscale: any;

if (window.PDFLib) {
    ({ PDFDocument, rgb, StandardFonts, TextAlignment, PDFName, PDFString, PDFHexString, grayscale } = window.PDFLib);
} else {
    console.error("PDFLib is not defined. Ensure pdf-lib library is loaded. PDF editing features may fail.");
    // Provide dummy objects or throw error to prevent further execution if critical
    // For now, they will remain undefined if PDFLib is not loaded.
}

export {
    PDFDocument, // Consider renaming to avoid conflict if PDFDocument type is also imported from 'pdf-lib'
    rgb,
    StandardFonts,
    TextAlignment,
    PDFName,
    PDFString,
    PDFHexString,
    grayscale,
};
