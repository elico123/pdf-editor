// js/utils.ts
import { loaderOverlay, loaderText } from './domElements.js'; // Or .ts, let's try .js first for Node ESM compatibility

// Define an interface for the RGB color object
interface RgbColor {
    r: number;
    g: number;
    b: number;
}

export const hasRtl = (s: string): boolean => {
    const rtlChars = '\u0590-\u05FF\u0600-\u06FF'; // Hebrew and Arabic character ranges
    const rtlRegex = new RegExp(`[${rtlChars}]`);
    return rtlRegex.test(s);
};

export const showLoader = (text: string): void => {
    if (loaderText && loaderOverlay) {
        loaderText.textContent = text;
        loaderOverlay.classList.remove('hidden');
    } else {
        // Fallback or error if elements not found, though they should be
        console.error("Loader elements not found in domElements.js for showLoader");
    }
};

export const hideLoader = (): void => {
    if (loaderOverlay) {
        loaderOverlay.classList.add('hidden');
    } else {
        console.error("Loader overlay not found in domElements.js for hideLoader");
    }
};

export const downloadBlob = (data: Uint8Array, fileName: string): void => {
    const blob = new Blob([data], { type: 'application/pdf' });
    const url: string = window.URL.createObjectURL(blob);
    const a: HTMLAnchorElement = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
};

export const hexToRgb = (hex: string | null | undefined): RgbColor | null => {
    if (!hex) return null;
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (_m: string, r: string, g: string, b: string): string => {
        return r + r + g + g + b + b;
    });

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
};
