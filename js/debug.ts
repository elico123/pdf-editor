// js/debug.ts

// Module-scoped variables to hold references to DOM elements, set by initDebugSystem
let internalDebugOverlay: HTMLElement | null = null;
let internalDebugMessagesContainer: HTMLElement | null = null;
let internalDebugClearBtn: HTMLButtonElement | null = null;
let internalDebugCloseBtn: HTMLButtonElement | null = null;
let internalDebugCopyBtn: HTMLButtonElement | null = null;
let internalToggleDebugBtn: HTMLButtonElement | null = null;

export interface DebugElements { // Added export
    debugOverlay: HTMLElement | null;
    debugMessagesContainer: HTMLElement | null;
    debugClearBtn: HTMLButtonElement | null;
    debugCloseBtn: HTMLButtonElement | null;
    debugCopyBtn: HTMLButtonElement | null;
    toggleDebugBtn: HTMLButtonElement | null;
}

interface LoggedMessage {
    timestamp: string;
    message: string;
    data?: any;
    type: 'log' | 'error' | 'warn' | 'info';
}

const loggedMessages: LoggedMessage[] = [];

const appendMessageToDebugView = (logEntry: LoggedMessage): void => {
    if (!internalDebugMessagesContainer) return;

    const msgDiv = document.createElement('div');
    let displayMessage = logEntry.message;
    if (logEntry.type === 'error') displayMessage = `ERROR: ${displayMessage}`;
    if (logEntry.type === 'warn') displayMessage = `WARN: ${displayMessage}`;
    if (logEntry.type === 'info') displayMessage = `INFO: ${displayMessage}`;

    msgDiv.innerHTML = `<strong>[${logEntry.timestamp}]</strong> ${displayMessage}`;
    if (logEntry.data !== undefined) {
        try {
            const prettyData: string = JSON.stringify(logEntry.data, null, 2);
            const dataPre = document.createElement('pre');
            dataPre.textContent = prettyData;
            dataPre.style.marginLeft = '10px';
            dataPre.style.padding = '2px';
            dataPre.style.backgroundColor = 'rgba(255,255,255,0.1)';
            dataPre.style.borderRadius = '3px';
            msgDiv.appendChild(dataPre);
        } catch (e: any) {
            const dataDiv = document.createElement('div');
            dataDiv.textContent = `[Unserializable data: ${e.message}]`;
            dataDiv.style.marginLeft = '10px';
            msgDiv.appendChild(dataDiv);
        }
    }
    internalDebugMessagesContainer.appendChild(msgDiv);
    internalDebugMessagesContainer.scrollTop = internalDebugMessagesContainer.scrollHeight;
};

export const logDebug = (message: string, data?: any, type: LoggedMessage['type'] = 'log'): void => {
    const timestamp: string = new Date().toLocaleTimeString();
    const logEntry: LoggedMessage = { timestamp, message, data, type };
    loggedMessages.push(logEntry);

    // For test debugging - use originalConsoleLog to avoid recursion
    // originalConsoleLog('[debug.ts] logDebug called. Message:', message);
    // originalConsoleLog('[debug.ts] logDebug: internalDebugOverlay defined?', !!internalDebugOverlay);
    // if (internalDebugOverlay) {
    //     originalConsoleLog('[debug.ts] logDebug: overlay hidden?', internalDebugOverlay.classList.contains('hidden'));
    // }
    // originalConsoleLog('[debug.ts] logDebug: internalDebugMessagesContainer defined?', !!internalDebugMessagesContainer);


    if (internalDebugOverlay && !internalDebugOverlay.classList.contains('hidden') && internalDebugMessagesContainer) {
        // originalConsoleLog('[debug.ts] logDebug: Condition to append is TRUE. Calling appendMessageToDebugView for:', message);
        appendMessageToDebugView(logEntry);
    } else {
        // originalConsoleLog('[debug.ts] logDebug: Condition to append is FALSE for:', message);
    }
};

// Store original console methods
const originalConsoleLog: (...data: any[]) => void = console.log;
const originalConsoleError: (...data: any[]) => void = console.error;
const originalConsoleWarn: (...data: any[]) => void = console.warn;
const originalConsoleInfo: (...data: any[]) => void = console.info;

// Override console methods
// Ensure these use the *original* methods for actual output, AFTER logging via logDebug.
console.log = (...args: any[]): void => { const messageStr = args.map(a => String(a)).join(' '); logDebug(messageStr, args.length > 1 ? args : undefined, 'log'); originalConsoleLog.apply(console, args); };
console.error = (...args: any[]): void => { logDebug(args.map(a => String(a)).join(' '), args.length > 1 ? args : undefined, 'error'); originalConsoleError.apply(console, args); };
console.warn = (...args: any[]): void => { logDebug(args.map(a => String(a)).join(' '), args.length > 1 ? args : undefined, 'warn'); originalConsoleWarn.apply(console, args); };
console.info = (...args: any[]): void => { logDebug(args.map(a => String(a)).join(' '), args.length > 1 ? args : undefined, 'info'); originalConsoleInfo.apply(console, args); };

const copyDebugLog = (): void => {
    if (loggedMessages.length === 0) {
        logDebug("Nothing to copy from debug log.");
        return;
    }
    const logText = loggedMessages.map(logEntry => {
        let text = `[${logEntry.timestamp}] `;
        if (logEntry.type === 'error') text += `ERROR: `;
        if (logEntry.type === 'warn') text += `WARN: `;
        if (logEntry.type === 'info') text += `INFO: `;
        text += logEntry.message;
        if (logEntry.data !== undefined) {
            try {
                text += `\n${JSON.stringify(logEntry.data, null, 2)}`;
            } catch (e) {
                text += `\n[Unserializable data]`;
            }
        }
        return text;
    }).join('\n\n');

    navigator.clipboard.writeText(logText)
        .then(() => {
            logDebug("Log copied to clipboard.");
        })
        .catch(err => {
            logDebug("Failed to copy log to clipboard.", err, 'error');
        });
};

export const initDebugSystem = (elements: DebugElements): void => {
    internalDebugOverlay = elements.debugOverlay;
    internalDebugMessagesContainer = elements.debugMessagesContainer;
    internalDebugClearBtn = elements.debugClearBtn;
    internalDebugCloseBtn = elements.debugCloseBtn;
    internalDebugCopyBtn = elements.debugCopyBtn;
    internalToggleDebugBtn = elements.toggleDebugBtn;

    // For test debugging:
    // console.log('[debug.ts] initDebugSystem received elements:', elements);
    // console.log('[debug.ts] internalDebugOverlay after assign:', internalDebugOverlay);
    // console.log('[debug.ts] internalDebugMessagesContainer after assign:', internalDebugMessagesContainer);


    if (internalDebugClearBtn) {
        internalDebugClearBtn.addEventListener('click', () => {
            if (internalDebugMessagesContainer) {
                internalDebugMessagesContainer.innerHTML = '';
            }
            loggedMessages.length = 0;
            logDebug("Debug log cleared.");
        });
    }

    if (internalDebugCloseBtn) {
        internalDebugCloseBtn.addEventListener('click', () => {
            if (internalDebugOverlay) internalDebugOverlay.classList.add('hidden');
        });
    }

    if (internalDebugCopyBtn) {
        internalDebugCopyBtn.addEventListener('click', copyDebugLog);
    }

    if (internalToggleDebugBtn) {
        internalToggleDebugBtn.addEventListener('click', () => {
            if (internalDebugOverlay && internalDebugMessagesContainer) {
                internalDebugOverlay.classList.toggle('hidden');
                if (!internalDebugOverlay.classList.contains('hidden')) {
                    internalDebugMessagesContainer.innerHTML = '';
                    loggedMessages.forEach(logEntry => appendMessageToDebugView(logEntry));
                    logDebug("Debug view opened.");
                }
            }
        });
    }
    // console.log("Debug system initialized with elements:", elements); // For app debugging
};
