// js/debug.mjs
import {
    debugOverlay,
    debugMessagesContainer,
    debugClearBtn,
    debugCloseBtn,
    toggleDebugBtn
} from './domElements.ts';

export const logDebug = (message: string, data?: any): void => {
    if (!debugOverlay || debugOverlay.classList.contains('hidden')) return; // Don't process if hidden or elements not found
    if (!debugMessagesContainer) return;

    const timestamp: string = new Date().toLocaleTimeString();
    const msgDiv = document.createElement('div');
    msgDiv.innerHTML = `<strong>[${timestamp}]</strong> ${message}`; // Be cautious with innerHTML if message is user-sourced
    if (data !== undefined) {
        try {
            const prettyData: string = JSON.stringify(data, null, 2);
            const dataPre = document.createElement('pre');
            dataPre.textContent = prettyData;
            dataPre.style.marginLeft = '10px'; // Consider CSS classes instead of inline styles
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
const originalConsoleLog: (...data: any[]) => void = console.log;
const originalConsoleError: (...data: any[]) => void = console.error;
const originalConsoleWarn: (...data: any[]) => void = console.warn;
const originalConsoleInfo: (...data: any[]) => void = console.info;

// Override console methods
console.log = (...args: any[]): void => { logDebug(args.map(a => String(a)).join(' '), args.length > 1 ? args.slice(1) : undefined); originalConsoleLog.apply(console, args); };
console.error = (...args: any[]): void => { logDebug(`ERROR: ${args.map(a => String(a)).join(' ')}`, args.length > 1 ? args.slice(1) : undefined); originalConsoleError.apply(console, args); };
console.warn = (...args: any[]): void => { logDebug(`WARN: ${args.map(a => String(a)).join(' ')}`, args.length > 1 ? args.slice(1) : undefined); originalConsoleWarn.apply(console, args); };
console.info = (...args: any[]): void => { logDebug(`INFO: ${args.map(a => String(a)).join(' ')}`, args.length > 1 ? args.slice(1) : undefined); originalConsoleInfo.apply(console, args); };

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
