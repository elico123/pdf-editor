// js/debug.js

// Module-scoped variables to hold references to DOM elements, set by initDebugSystem
let internalDebugOverlay = null;
let internalDebugMessagesContainer = null;
let internalDebugClearBtn = null;
let internalDebugCloseBtn = null;
let internalDebugCopyBtn = null;
let internalToggleDebugBtn = null;

/**
 * @typedef {object} DebugElements
 * @property {HTMLElement | null} debugOverlay
 * @property {HTMLElement | null} debugMessagesContainer
 * @property {HTMLButtonElement | null} debugClearBtn
 * @property {HTMLButtonElement | null} debugCloseBtn
 * @property {HTMLButtonElement | null} debugCopyBtn
 * @property {HTMLButtonElement | null} toggleDebugBtn
 */

/**
 * @typedef {object} LoggedMessage
 * @property {string} timestamp
 * @property {string} message
 * @property {any} [data]
 * @property {'log' | 'error' | 'warn' | 'info'} type
 */

/** @type {LoggedMessage[]} */
const loggedMessages = [];

/**
 * @param {LoggedMessage} logEntry
 * @returns {void}
 */
const appendMessageToDebugView = (logEntry) => {
    if (!internalDebugMessagesContainer) return;

    const msgDiv = document.createElement('div');
    let displayMessage = logEntry.message;
    if (logEntry.type === 'error') displayMessage = `ERROR: ${displayMessage}`;
    if (logEntry.type === 'warn') displayMessage = `WARN: ${displayMessage}`;
    if (logEntry.type === 'info') displayMessage = `INFO: ${displayMessage}`;

    msgDiv.innerHTML = `<strong>[${logEntry.timestamp}]</strong> ${displayMessage}`;
    if (logEntry.data !== undefined) {
        try {
            const prettyData = JSON.stringify(logEntry.data, null, 2);
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
    internalDebugMessagesContainer.appendChild(msgDiv);
    internalDebugMessagesContainer.scrollTop = internalDebugMessagesContainer.scrollHeight;
};

/**
 * @param {string} message
 * @param {any} [data]
 * @param {'log' | 'error' | 'warn' | 'info'} [type='log']
 * @returns {void}
 */
export const logDebug = (message, data, type = 'log') => {
    const timestamp = new Date().toLocaleTimeString();
    /** @type {LoggedMessage} */
    const logEntry = { timestamp, message, data, type };
    loggedMessages.push(logEntry);

    if (internalDebugOverlay && !internalDebugOverlay.classList.contains('hidden') && internalDebugMessagesContainer) {
        appendMessageToDebugView(logEntry);
    }
};

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

// Override console methods
// Ensure these use the *original* methods for actual output, AFTER logging via logDebug.
console.log = (...args) => { const messageStr = args.map(a => String(a)).join(' '); logDebug(messageStr, args.length > 1 ? args : undefined, 'log'); originalConsoleLog.apply(console, args); };
console.error = (...args) => { logDebug(args.map(a => String(a)).join(' '), args.length > 1 ? args : undefined, 'error'); originalConsoleError.apply(console, args); };
console.warn = (...args) => { logDebug(args.map(a => String(a)).join(' '), args.length > 1 ? args : undefined, 'warn'); originalConsoleWarn.apply(console, args); };
console.info = (...args) => { logDebug(args.map(a => String(a)).join(' '), args.length > 1 ? args : undefined, 'info'); originalConsoleInfo.apply(console, args); };

/** @returns {void} */
const copyDebugLog = () => {
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

/**
 * @param {DebugElements} elements
 * @returns {void}
 */
export const initDebugSystem = (elements) => {
    internalDebugOverlay = elements.debugOverlay;
    internalDebugMessagesContainer = elements.debugMessagesContainer;
    internalDebugClearBtn = elements.debugClearBtn;
    internalDebugCloseBtn = elements.debugCloseBtn;
    internalDebugCopyBtn = elements.debugCopyBtn;
    internalToggleDebugBtn = elements.toggleDebugBtn;

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
};
