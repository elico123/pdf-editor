// js/utils.mjs
import { loaderOverlay as defaultLoaderOverlay, loaderText as defaultLoaderText } from './domElements.mjs';

export const hasRtl = (s) => {
    const rtlChars = '\u0590-\u05FF\u0600-\u06FF'; // Hebrew and Arabic character ranges
    const rtlRegex = new RegExp(`[${rtlChars}]`);
    return rtlRegex.test(s);
};

export const showLoader = (text, loaderText = defaultLoaderText, loaderOverlay = defaultLoaderOverlay) => {
    if (loaderText && loaderOverlay) {
        loaderText.textContent = text;
        loaderOverlay.classList.remove('hidden');
    } else {
        // Fallback or error if elements not found, though they should be
        console.error("Loader elements not found for showLoader. Ensure they are correctly passed or available in default DOM elements.");
    }
};

export const hideLoader = (loaderOverlay = defaultLoaderOverlay) => {
    if (loaderOverlay) {
        loaderOverlay.classList.add('hidden');
    } else {
        console.error("Loader overlay not found for hideLoader. Ensure it is correctly passed or available in default DOM elements.");
    }
};

export const downloadBlob = (data, fileName) => {
    const blob = new Blob([data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
};

export const hexToRgb = hex => {
    if (!hex) return null;
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => {
        return r + r + g + g + b + b;
    });

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
};
