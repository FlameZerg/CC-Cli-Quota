const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');

let statusBarItems = new Map();
let fallbackStatusBarItem;
let outputChannel;
let refreshTimer;
const scriptPath = path.join(__dirname, 'cclimits.py');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    outputChannel = vscode.window.createOutputChannel("AI Quotas");
    context.subscriptions.push(outputChannel);

    fallbackStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    fallbackStatusBarItem.text = `$(circle-slash) AI: Off`;
    fallbackStatusBarItem.tooltip = "No AI providers enabled or authenticated.";
    fallbackStatusBarItem.command = 'cc-cli-quota.toggleProviders';
    context.subscriptions.push(fallbackStatusBarItem);

    let checkCmd = vscode.commands.registerCommand('cc-cli-quota.check', () => {
        const terminalName = "AI Quotas";
        let terminal = vscode.window.terminals.find(t => t.name === terminalName);
        if (!terminal) {
            terminal = vscode.window.createTerminal(terminalName);
        }
        terminal.show();
        const reverseDisplay = vscode.workspace.getConfiguration('cclimits').get('reverseDisplay') === true;
        let cmd = `python "${scriptPath}"`;
        if (reverseDisplay) cmd += ' --reverse';
        // Run without --json to get pretty colored output
        terminal.sendText(cmd);
    });
    context.subscriptions.push(checkCmd);

    let toggleCmd = vscode.commands.registerCommand('cc-cli-quota.toggleProviders', async () => {
        const config = vscode.workspace.getConfiguration('cclimits');
        const enabled = config.get('enabledProviders') || [];
        const useCached = config.get('useCached');
        const zaiKey = config.get('zaiApiKey');
        const openRouterKey = config.get('openrouterApiKey');
        const refreshInterval = config.get('refreshInterval') || 2;
        const autoRefresh = config.get('autoRefresh') !== false; // Default true

        const allProviders = [
            { id: 'claude', label: 'Claude', detail: 'Claude Code usage (5h/7d)' },
            { id: 'codex', label: 'Codex', detail: 'ChatGPT/Codex usage (5h/7d)' },
            { id: 'gemini', label: 'Gemini', detail: 'Google Gemini usage (GCP-based)' },
            { id: 'zai', label: 'Zai', detail: 'Z.AI shared token quota' },
            { id: 'openrouter', label: 'Openrouter', detail: 'OpenRouter API Credit balance' }
        ];
        
        const items = [
            { label: "--- Providers ---", kind: vscode.QuickPickItemKind ? vscode.QuickPickItemKind.Separator : undefined },
            ...allProviders.map(p => ({
                id: p.id,
                label: p.label,
                picked: enabled.includes(p.id),
                description: enabled.includes(p.id) ? "$(check) Enabled" : "$(x) Disabled",
                detail: p.detail
            })),
            { label: "--- API Keys ---", kind: vscode.QuickPickItemKind ? vscode.QuickPickItemKind.Separator : undefined },
            {
                id: "setZaiKey",
                label: "$(key) Set Z.AI API Key",
                picked: !!zaiKey,
                detail: zaiKey ? "Key stored (****" + zaiKey.slice(-4) + ")" : "Please configure your Z.AI API Key"
            },
            {
                id: "setOpenRouterKey",
                label: "$(key) Set OpenRouter API Key",
                picked: !!openRouterKey,
                detail: openRouterKey ? "Key stored (****" + openRouterKey.slice(-4) + ")" : "Please configure your OpenRouter API Key"
            },
            { label: "--- Settings ---", kind: vscode.QuickPickItemKind ? vscode.QuickPickItemKind.Separator : undefined },
            {
                id: "toggleReverseDisplay",
                label: "$(arrow-swap) Toggle Display Mode",
                picked: config.get('reverseDisplay') === true,
                description: config.get('reverseDisplay') ? "$(check) 100% = Full Quota" : "$(x) 0% = Full Quota",
                detail: config.get('reverseDisplay') ? "Reversed mode: 100%->0% (100% means full quota)" : "Default mode: 0%->100% (0% means full quota)"
            },
            {
                id: "setRefreshInterval",
                label: "$(watch) Set Refresh Interval",
                picked: autoRefresh,
                detail: autoRefresh ? `Active: Every ${refreshInterval} minutes` : `Disabled (Default: ${refreshInterval}m)`
            },
            {
                id: "useCache",
                label: "$(history) Use Cache",
                picked: useCached,
                description: useCached ? "$(check) On" : "$(x) Off",
                detail: "Use cached data if fresh (<60s) to reduce network calls"
            }
        ];

        const selected = await vscode.window.showQuickPick(items, {
            canPickMany: true,
            title: "CC Cli Quota: Providers & Settings"
        });

        if (selected) {
            // Handle Z.AI Key
            if (selected.some(i => i.id === "setZaiKey")) {
                // If selected, always prompt to allow editing
                const key = await vscode.window.showInputBox({ 
                    prompt: "Enter Z.AI API Key (Leave empty to clear)", 
                    password: true,
                    value: zaiKey || ""
                });
                if (key !== undefined) {
                     await config.update('zaiApiKey', key, vscode.ConfigurationTarget.Global);
                }
            } else {
                // Unchecked -> Clear key if it exists
                if (zaiKey) await config.update('zaiApiKey', "", vscode.ConfigurationTarget.Global);
            }

            // Handle OpenRouter Key
            if (selected.some(i => i.id === "setOpenRouterKey")) {
                const key = await vscode.window.showInputBox({ 
                    prompt: "Enter OpenRouter API Key (Leave empty to clear)", 
                    password: true,
                    value: openRouterKey || ""
                });
                if (key !== undefined) {
                    await config.update('openrouterApiKey', key, vscode.ConfigurationTarget.Global);
                }
            } else {
                // Unchecked -> Clear key if it exists
                if (openRouterKey) await config.update('openrouterApiKey', "", vscode.ConfigurationTarget.Global);
            }

            // Handle Reverse Display
            const newReverseDisplay = selected.some(i => i.id === "toggleReverseDisplay");
            await config.update('reverseDisplay', newReverseDisplay, vscode.ConfigurationTarget.Global);

            // Handle Refresh Interval
            if (selected.some(i => i.id === "setRefreshInterval")) {
                // Check if we need to enable it
                if (!autoRefresh) {
                    await config.update('autoRefresh', true, vscode.ConfigurationTarget.Global);
                }
                
                // Always prompt if checked, to allow changing the value
                // Use current config value as default
                const val = await vscode.window.showInputBox({ 
                    prompt: "Enter refresh interval (1-60 minutes)", 
                    placeHolder: "2",
                    value: refreshInterval.toString(),
                    validateInput: (v) => {
                        const n = parseInt(v);
                        return (isNaN(n) || n < 1 || n > 60) ? "Please enter a number between 1 and 60" : null;
                    }
                });
                if (val !== undefined) {
                    const newInterval = parseInt(val);
                    await config.update('refreshInterval', newInterval, vscode.ConfigurationTarget.Global);
                    startTimer(newInterval * 60);
                } else if (!autoRefresh) {
                    // If user cancelled input but enabled the checkbox (and it was previously disabled)
                    // we should probably start the timer with existing interval
                     startTimer(refreshInterval * 60);
                }
            } else {
                // Unchecked -> Disable auto refresh
                if (autoRefresh) {
                    await config.update('autoRefresh', false, vscode.ConfigurationTarget.Global);
                    if (refreshTimer) clearInterval(refreshTimer);
                    refreshTimer = null;
                }
            }

            const providerIds = allProviders.map(p => p.id);
            const newEnabled = selected.filter(i => providerIds.includes(i.id)).map(i => i.id);
            await config.update('enabledProviders', newEnabled, vscode.ConfigurationTarget.Global);

            const newUseCached = selected.some(i => i.id === "useCache");
            await config.update('useCached', newUseCached, vscode.ConfigurationTarget.Global);

            vscode.window.showInformationMessage("CC Cli Quota configuration updated.");
            updateStatusBar(false, true); 
        }
    });
    context.subscriptions.push(toggleCmd);

    const config = vscode.workspace.getConfiguration('cclimits');
    updateStatusBar();
    
    // Initial start based on config
    const autoRefresh = config.get('autoRefresh') !== false;
    if (autoRefresh) {
        startTimer((config.get('refreshInterval') || 2) * 60);
    }

    // Listen for configuration changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('cclimits.refreshInterval') || e.affectsConfiguration('cclimits.autoRefresh')) {
            const newConfig = vscode.workspace.getConfiguration('cclimits');
            const newInterval = newConfig.get('refreshInterval') || 2;
            const newAuto = newConfig.get('autoRefresh') !== false;
            
            if (newAuto) {
                startTimer(newInterval * 60);
                outputChannel.appendLine(`[Info] Auto-refresh active: ${newInterval}m.`);
            } else {
                if (refreshTimer) clearInterval(refreshTimer);
                refreshTimer = null;
                outputChannel.appendLine(`[Info] Auto-refresh disabled.`);
            }
        }
    }));
}

function startTimer(seconds) {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => updateStatusBar(), seconds * 1000);
}

let lastResults = {};

async function updateStatusBar(logTrigger = false, bypassCache = false, isRetry = false, providersToRetry = null) {
    const config = vscode.workspace.getConfiguration('cclimits');
    const enabled = config.get('enabledProviders') || [];
    const useCached = config.get('useCached') && !bypassCache;
    const reverseDisplay = config.get('reverseDisplay') === true;
    
    // If retrying, only fetch specific providers. Otherwise fetch all enabled.
    const providersToFetch = isRetry && providersToRetry ? providersToRetry : enabled;

    if (providersToFetch.length === 0) {
        // Nothing to fetch? 
        return;
    }

    let command = `python "${scriptPath}" --json`;
    if (useCached && !isRetry) command += ` --cached`; // Don't use cache on retry usually
    if (reverseDisplay) command += ` --reverse`;

    providersToFetch.forEach(p => command += ` --${p}`);


    exec(command, {
        env: {
            ...process.env,
            ZAI_API_KEY: config.get('zaiApiKey') || process.env.ZAI_API_KEY,
            OPENROUTER_API_KEY: config.get('openrouterApiKey') || process.env.OPENROUTER_API_KEY
        }
    }, (error, stdout) => {
        if (error) {
            outputChannel.appendLine(`[Error] ${error.message}`);
            
            // If total failure (script didn't run), we might want to retry ALL enabled
            if (!isRetry) {
                if (statusBarItems.size === 0) fallbackStatusBarItem.show();
                
                outputChannel.appendLine(`[Info] Update failed completely. Retrying all in 10 seconds...`);
                setTimeout(() => updateStatusBar(logTrigger, bypassCache, true, enabled), 10000);
            }
            return;
        }

        try {
            const currentResults = JSON.parse(stdout);
            
            // Merge with last results
            // If it's a retry, currentResults only has the retried providers
            lastResults = { ...lastResults, ...currentResults };

            const providerNames = {
                claude: 'Claude',
                codex: 'Codex',
                gemini: 'Gemini',
                zai: 'Zai',
                openrouter: 'Openrouter'
            };

            const parsePct = (val) => val ? parseFloat(val.replace('%', '')) : 0;

            let anyVisible = false;
            let failedProviders = [];

            // Identify which enabled providers failed or are missing in the MERGED results
            // But for retry logic, we specifically care about the ones we just tried to fetch
            providersToFetch.forEach(id => {
                 if (!currentResults[id] || currentResults[id].error) {
                     failedProviders.push(id);
                 }
            });

            // Update UI based on MERGED lastResults
            // Hide items for providers not in enabled list/or removed
            statusBarItems.forEach((item, id) => {
                if (!enabled.includes(id)) {
                    item.hide();
                }
            });

            Object.entries(lastResults).forEach(([id, data]) => {
                if (!data || !enabled.includes(id)) return;
                
                // If it has an error, we don't necessarily hide it if we have stale data? 
                // Actually cclimits.py returns {error: ...} on failure.
                // If we have an error in lastResults, we probably shouldn't show it unless we want to show "Error" status?
                // For now, let's keep behavior: hide if error.
                if (data.error) {
                    const item = statusBarItems.get(id);
                    if (item) item.hide();
                    return;
                }

                let item = statusBarItems.get(id);
                if (!item) {
                    item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
                    item.command = 'cc-cli-quota.toggleProviders';
                    statusBarItems.set(id, item);
                }

                let p5h = 0, p7d = 0, label = providerNames[id] || id;
                let tooltip = `${label} Usage Details:`;

                if (id === 'claude') {
                    p5h = parsePct(data.five_hour?.used);
                    p7d = parsePct(data.seven_day?.used);
                    let line5h = `- ${data.five_hour?.used || '0%'} (5h)`;
                    if (data.five_hour?.resets_in) line5h += ` | Reset in ${data.five_hour.resets_in}`;
                    let line7d = `- ${data.seven_day?.used || '0%'} (7d)`;
                    if (data.seven_day?.resets_in) line7d += ` | Reset in ${data.seven_day.resets_in}`;
                    tooltip += `\n${line5h}\n${line7d}`;
                } else if (id === 'codex') {
                    p5h = parsePct(data.primary_window?.used);
                    p7d = parsePct(data.secondary_window?.used);
                    let line5h = `- ${data.primary_window?.used || '0%'} (5h)`;
                    if (data.primary_window?.resets_in) line5h += ` | Reset in ${data.primary_window.resets_in}`;
                    let line7d = `- ${data.secondary_window?.used || '0%'} (7d)`;
                    if (data.secondary_window?.resets_in) line7d += ` | Reset in ${data.secondary_window.resets_in}`;
                    tooltip += `\n${line5h}\n${line7d}`;
                } else if (id === 'gemini' && data.models) {
                    let gMax = 0;
                    let gMin = 100;
                    Object.entries(data.models).forEach(([m, d]) => {
                        const val = parsePct(d.used);
                        if (val > gMax) gMax = val;
                        if (val < gMin) gMin = val;
                        let line = `\n- ${d.used} (${m})`;
                        if (d.resets_in) line += ` | Reset in ${d.resets_in}`;
                        tooltip += line;
                    });
                    p5h = reverseDisplay ? gMin : gMax;
                } else if (id === 'zai') {
                    p5h = data.token_quota?.percentage || 0;
                    let line = `\n- ${p5h}% (Quota)`;
                    if (data.token_quota?.resets_in) line += ` | Reset in ${data.token_quota.resets_in}`;
                    tooltip += line;
                } else if (id === 'openrouter') {
                    if (data.balance_usd !== undefined) {
                      item.text = `$(pulse) ${label}: $${data.balance_usd.toFixed(2)}`;
                      item.tooltip = `${label}: $${data.balance_usd.toFixed(2)} (Balance)`;
                      item.show();
                      anyVisible = true;
                      return;
                    }
                }

                let text = `$(pulse) ${label}: ${p5h}%`;
                if (p7d > 0) text += `|${p7d}%`;
                item.text = text;
                item.tooltip = tooltip;

                let applyReverseLogic = reverseDisplay && ['claude', 'codex', 'gemini', 'zai'].includes(id);
                let isBad = false;
                let isWarn = false;
                if (!applyReverseLogic) {
                    let stat = p5h;
                    if (data.seven_day || data.secondary_window) stat = Math.max(p5h, p7d);
                    if (stat >= 90) isBad = true;
                    else if (stat >= 70) isWarn = true;
                } else {
                    let stat = p5h;
                    if (data.seven_day || data.secondary_window) stat = Math.min(p5h, p7d);
                    if (stat <= 10) isBad = true;
                    else if (stat <= 30) isWarn = true;
                }

                if (isBad) item.color = new vscode.ThemeColor('statusBarItem.errorForeground');
                else if (isWarn) item.color = new vscode.ThemeColor('statusBarItem.warningForeground');
                else item.color = undefined;

                item.show();
                anyVisible = true;
            });

            if (anyVisible) {
                fallbackStatusBarItem.hide();
            } else {
                if (statusBarItems.size === 0 || !anyVisible) {
                     // Check if we really have nothing visible
                     let reallyVisible = false;
                     statusBarItems.forEach(i => { if(i.text) reallyVisible = true; });
                     if (!reallyVisible) fallbackStatusBarItem.show();
                }
            }

            if (logTrigger) outputChannel.appendLine(stdout);

            // Trigger retry for partial failures
            if (!isRetry && failedProviders.length > 0) {
                 outputChannel.appendLine(`[Info] Partial update failed for: ${failedProviders.join(', ')}. Retrying in 10 seconds...`);
                 setTimeout(() => updateStatusBar(logTrigger, bypassCache, true, failedProviders), 10000);
            }

        } catch (e) {
            outputChannel.appendLine(`[Error] Parse failed: ${e.message}`);
            // Retry all if parse failed
             if (!isRetry) {
                outputChannel.appendLine(`[Info] Update failed (parse detection). Retrying all in 10 seconds...`);
                setTimeout(() => updateStatusBar(logTrigger, bypassCache, true, enabled), 10000);
            }
             if (statusBarItems.size === 0) {
                fallbackStatusBarItem.show();
            }
        }
    });
}

function deactivate() {
    if (refreshTimer) clearInterval(refreshTimer);
    statusBarItems.forEach(item => item.dispose());
}

module.exports = { activate, deactivate };
