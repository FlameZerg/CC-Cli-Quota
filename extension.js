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
        // Run without --json to get pretty colored output
        terminal.sendText(`python "${scriptPath}"`);
    });
    context.subscriptions.push(checkCmd);

    let toggleCmd = vscode.commands.registerCommand('cc-cli-quota.toggleProviders', async () => {
        const config = vscode.workspace.getConfiguration('cclimits');
        const enabled = config.get('enabledProviders') || [];
        const useCached = config.get('useCached');
        const allProviders = [
            { id: 'claude', label: 'Claude', detail: 'Claude Code usage (5h/7d)' },
            { id: 'codex', label: 'Codex', detail: 'ChatGPT/Codex usage (5h/7d)' },
            { id: 'gemini', label: 'Gemini', detail: 'Google Gemini usage (GCP-based)' },
            { id: 'zai', label: 'Zai', detail: 'Z.AI shared token quota' },
            { id: 'openrouter', label: 'Openrouter', detail: 'OpenRouter API Credit balance' }
        ];
        
        const refreshInterval = config.get('refreshInterval') || 2;
        
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
                detail: config.get('zaiApiKey') ? "Key stored (****" + config.get('zaiApiKey').slice(-4) + ")" : "Please configure your Z.AI API Key"
            },
            {
                id: "setOpenRouterKey",
                label: "$(key) Set OpenRouter API Key",
                detail: config.get('openrouterApiKey') ? "Key stored (****" + config.get('openrouterApiKey').slice(-4) + ")" : "Please configure your OpenRouter API Key"
            },
            { label: "--- Settings ---", kind: vscode.QuickPickItemKind ? vscode.QuickPickItemKind.Separator : undefined },
            {
                id: "setRefreshInterval",
                label: "$(watch) Set Refresh Interval",
                detail: `Current: Every ${refreshInterval} minutes`
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
            // Handle API Key settings 
            if (selected.some(i => i.id === "setZaiKey")) {
                const key = await vscode.window.showInputBox({ 
                    prompt: "Enter Z.AI API Key", 
                    password: true,
                    value: config.get('zaiApiKey') 
                });
                if (key !== undefined) await config.update('zaiApiKey', key, vscode.ConfigurationTarget.Global);
            }
            if (selected.some(i => i.id === "setOpenRouterKey")) {
                const key = await vscode.window.showInputBox({ 
                    prompt: "Enter OpenRouter API Key", 
                    password: true,
                    value: config.get('openrouterApiKey') 
                });
                if (key !== undefined) await config.update('openrouterApiKey', key, vscode.ConfigurationTarget.Global);
            }
            if (selected.some(i => i.id === "setRefreshInterval")) {
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
    startTimer((config.get('refreshInterval') || 2) * 60);

    // Listen for configuration changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('cclimits.refreshInterval')) {
            const newConfig = vscode.workspace.getConfiguration('cclimits');
            const newInterval = newConfig.get('refreshInterval') || 2;
            startTimer(newInterval * 60);
            outputChannel.appendLine(`[Info] Refresh interval updated to ${newInterval} minutes.`);
        }
    }));
}

function startTimer(seconds) {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => updateStatusBar(), seconds * 1000);
}

async function updateStatusBar(logTrigger = false, bypassCache = false) {
    const config = vscode.workspace.getConfiguration('cclimits');
    const enabled = config.get('enabledProviders') || [];
    const useCached = config.get('useCached') && !bypassCache;
    
    let command = `python "${scriptPath}" --json`;
    if (useCached) command += ` --cached`;

    if (enabled.length > 0) {
        enabled.forEach(p => command += ` --${p}`);
    } else {
        statusBarItems.forEach(item => item.hide());
        fallbackStatusBarItem.show();
        return;
    }

    exec(command, {
        env: {
            ...process.env,
            ZAI_API_KEY: config.get('zaiApiKey') || process.env.ZAI_API_KEY,
            OPENROUTER_API_KEY: config.get('openrouterApiKey') || process.env.OPENROUTER_API_KEY
        }
    }, (error, stdout) => {
        if (error) {
            outputChannel.appendLine(`[Error] ${error.message}`);
            fallbackStatusBarItem.show();
            return;
        }

        try {
            const results = JSON.parse(stdout);
            const providerNames = {
                claude: 'Claude',
                codex: 'Codex',
                gemini: 'Gemini',
                zai: 'Zai',
                openrouter: 'Openrouter'
            };

            const parsePct = (val) => val ? parseFloat(val.replace('%', '')) : 0;

            let anyVisible = false;

            // Hide items for providers not in this update
            statusBarItems.forEach((item, id) => {
                if (!results[id] || results[id].error || !enabled.includes(id)) {
                    item.hide();
                }
            });

            Object.entries(results).forEach(([id, data]) => {
                if (!data || data.error || !enabled.includes(id)) return;

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
                    Object.entries(data.models).forEach(([m, d]) => {
                        const val = parsePct(d.used);
                        if (val > gMax) gMax = val;
                        let line = `\n- ${d.used} (${m})`;
                        if (d.resets_in) line += ` | Reset in ${d.resets_in}`;
                        tooltip += line;
                    });
                    p5h = gMax;
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

                const max = Math.max(p5h, p7d);
                if (max >= 90) item.color = new vscode.ThemeColor('statusBarItem.errorForeground');
                else if (max >= 70) item.color = new vscode.ThemeColor('statusBarItem.warningForeground');
                else item.color = undefined;

                item.show();
                anyVisible = true;
            });

            if (anyVisible) {
                fallbackStatusBarItem.hide();
            } else {
                fallbackStatusBarItem.show();
            }

            if (logTrigger) outputChannel.appendLine(stdout);
        } catch (e) {
            outputChannel.appendLine(`[Error] Parse failed: ${e.message}`);
            fallbackStatusBarItem.show();
        }
    });
}

function deactivate() {
    if (refreshTimer) clearInterval(refreshTimer);
    statusBarItems.forEach(item => item.dispose());
}

module.exports = { activate, deactivate };
