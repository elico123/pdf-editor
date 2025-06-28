// js/utils.js
import { loaderOverlay, loaderText } from './domElements.js';

export const hasRtl = (s) => {
    const rtlChars = '\u0590-\u05FF\u0600-\u06FF'; // Hebrew and Arabic character ranges
    const rtlRegex = new RegExp(`[${rtlChars}]`);
    return rtlRegex.test(s);
};

export const showLoader = text => {
    if (loaderText && loaderOverlay) {
        loaderText.textContent = text;
        loaderOverlay.classList.remove('hidden');
    } else {
        // Fallback or error if elements not found, though they should be
        console.error("Loader elements not found in domElements.js for showLoader");
    }
};

export const hideLoader = () => {
    if (loaderOverlay) {
        loaderOverlay.classList.add('hidden');
    } else {
        console.error("Loader overlay not found in domElements.js for hideLoader");
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
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
};
