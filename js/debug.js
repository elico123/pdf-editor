// js/debug.js
import {
    debugOverlay,
    debugMessagesContainer,
    debugClearBtn,
    debugCloseBtn,
    toggleDebugBtn
} from './domElements.js';

export const logDebug = (message, data) => {
    if (!debugOverlay || debugOverlay.classList.contains('hidden')) return; // Don't process if hidden or elements not found
    if (!debugMessagesContainer) return;

    const timestamp = new Date().toLocaleTimeString();
    const msgDiv = document.createElement('div');
    msgDiv.innerHTML = `<strong>[${timestamp}]</strong> ${message}`;
    if (data !== undefined) {
        try {
            const prettyData = JSON.stringify(data, null, 2);
            const dataPre = document.createElement('pre');
            dataPre.textContent = prettyData;
            dataPre.style.marginLeft = '10px';
            dataPre.style.padding = '2px';
            dataPre.style.backgroundColor = 'rgba(255,255,255,0.1)';
            dataPre.style.borderRadius = '3px';
            msgDiv.appendChild(dataPre);
        } catch (e) {
            const dataDiv = document.createElement('div');
            dataDiv.textContent = `[Unserializable data: ${e.message}]`;
            dataDiv.style.marginLeft = '10px';
            msgDiv.appendChild(dataDiv);
        }
    }
    debugMessagesContainer.appendChild(msgDiv);
    debugMessagesContainer.scrollTop = debugMessagesContainer.scrollHeight; // Auto-scroll
};

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

// Override console methods
console.log = (...args) => { logDebug(args.map(a => String(a)).join(' '), args.length > 1 ? args.slice(1) : undefined); originalConsoleLog.apply(console, args); };
console.error = (...args) => { logDebug(`ERROR: ${args.map(a => String(a)).join(' ')}`, args.length > 1 ? args.slice(1) : undefined); originalConsoleError.apply(console, args); };
console.warn = (...args) => { logDebug(`WARN: ${args.map(a => String(a)).join(' ')}`, args.length > 1 ? args.slice(1) : undefined); originalConsoleWarn.apply(console, args); };
console.info = (...args) => { logDebug(`INFO: ${args.map(a => String(a)).join(' ')}`, args.length > 1 ? args.slice(1) : undefined); originalConsoleInfo.apply(console, args); };

// Event Listeners for debug controls
if (debugClearBtn) {
    debugClearBtn.addEventListener('click', () => {
        if (debugMessagesContainer) debugMessagesContainer.innerHTML = '';
    });
}

if (debugCloseBtn) {
    debugCloseBtn.addEventListener('click', () => {
        if (debugOverlay) debugOverlay.classList.add('hidden');
    });
}

if (toggleDebugBtn) {
    toggleDebugBtn.addEventListener('click', () => {
        if (debugOverlay) {
            debugOverlay.classList.toggle('hidden');
            if (!debugOverlay.classList.contains('hidden')) {
                logDebug("Debug view opened.");
            }
        }
    });
}

// Initial log to confirm debug module loaded if view is already open (unlikely on first load)
// or just to ensure it's initialized.
// logDebug("Debug module initialized."); // This might be too early if elements aren't ready.
                                        // Best to let app.js call an init if needed.
                                        // For now, event listeners are conditional on elements existing.
