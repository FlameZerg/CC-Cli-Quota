const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');

let myStatusBarItem;
let outputChannel;
let refreshTimer;
const scriptPath = path.join(__dirname, 'cclimits.py');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    outputChannel = vscode.window.createOutputChannel("AI Quotas");
    context.subscriptions.push(outputChannel);

    myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    myStatusBarItem.command = 'cc-cli-quota.toggleProviders';
    context.subscriptions.push(myStatusBarItem);

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
            { id: 'claude', label: 'claude', detail: 'Claude Code usage (5h/7d window)' },
            { id: 'codex', label: 'codex', detail: 'ChatGPT/Codex usage (5h/7d window)' },
            { id: 'gemini', label: 'gemini', detail: 'Google Gemini usage (GCP-based)' },
            { id: 'zai', label: 'zai', detail: 'Z.AI shared token quota' },
            { id: 'openrouter', label: 'openrouter', detail: 'OpenRouter API Credit balance' }
        ];
        
        const items = [
            { label: "--- Providers ---", kind: vscode.QuickPickItemKind.Separator },
            ...allProviders.map(p => ({
                label: p.label,
                picked: enabled.includes(p.id),
                description: enabled.includes(p.id) ? "$(check) Enabled" : "$(x) Disabled",
                detail: p.detail
            })),
            { label: "--- Settings ---", kind: vscode.QuickPickItemKind.Separator },
            {
                label: "Use Cache",
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
            const providerIds = allProviders.map(p => p.id);
            const newEnabled = selected.filter(i => providerIds.includes(i.label)).map(i => i.label);
            await config.update('enabledProviders', newEnabled, vscode.ConfigurationTarget.Global);

            const newUseCached = selected.some(i => i.label === "Use Cache");
            await config.update('useCached', newUseCached, vscode.ConfigurationTarget.Global);

            vscode.window.showInformationMessage("CC Cli Quota configuration updated.");
            updateStatusBar(false, true); 
        }
    });
    context.subscriptions.push(toggleCmd);

    updateStatusBar();
    startTimer(120); 
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

    if (enabled.length > 0 && enabled.length < 5) {
        enabled.forEach(p => command += ` --${p}`);
    } else if (enabled.length === 0) {
        myStatusBarItem.text = `$(circle-slash) AI: Off`;
        myStatusBarItem.tooltip = "All providers disabled.";
        myStatusBarItem.show();
        return;
    }

    exec(command, (error, stdout, stderr) => {
        if (error) {
            outputChannel.appendLine(`[Error] ${error.message}`);
            myStatusBarItem.text = `$(error) AI: Err`;
            myStatusBarItem.show();
            return;
        }

        try {
            const results = JSON.parse(stdout);
            let peak5h = 0;
            let peak7d = 0;
            let tooltipLines = ["AI Usage Details"];
            let prioritizedProvider = null;

            const priorityOrder = ['claude', 'codex', 'gemini', 'zai', 'openrouter'];

            const processMetric = (providerId, providerData) => {
                if (!providerData || providerData.error) return;

                let local5h = 0;
                let local7d = 0;

                const parsePct = (val) => val ? parseFloat(val.replace('%', '')) : 0;

                if (providerId === 'claude') {
                    local5h = parsePct(providerData.five_hour?.used);
                    local7d = parsePct(providerData.seven_day?.used);
                    tooltipLines.push(`- Claude: ${providerData.five_hour?.used || '0%'} (5h) | ${providerData.seven_day?.used || '0%'} (7d)`);
                } else if (providerId === 'codex') {
                    local5h = parsePct(providerData.primary_window?.used);
                    local7d = parsePct(providerData.secondary_window?.used);
                    tooltipLines.push(`- Codex: ${providerData.primary_window?.used || '0%'} (5h) | ${providerData.secondary_window?.used || '0%'} (7d)`);
                } else if (providerId === 'gemini') {
                    if (providerData.models) {
                        let gMax = 0;
                        Object.entries(providerData.models).forEach(([m, d]) => {
                            const p = parsePct(d.used);
                            if (p > gMax) gMax = p;
                            tooltipLines.push(`  * ${m}: ${d.used}`);
                        });
                        local5h = gMax;
                        tooltipLines.push(`- Gemini: ${gMax}% (Max across models)`);
                    }
                } else if (providerId === 'zai') {
                    local5h = providerData.token_quota?.percentage || 0;
                    tooltipLines.push(`- Z.AI: ${local5h}%`);
                } else if (providerId === 'openrouter') {
                    if (providerData.balance_usd !== undefined) {
                        tooltipLines.push(`- OpenRouter: $${providerData.balance_usd.toFixed(2)}`);
                    }
                }

                // If this is the chosen prioritized provider, set the status bar values
                if (providerId === prioritizedProvider) {
                    peak5h = local5h;
                    peak7d = local7d;
                }
            };

            // 1. Determine which provider to show on status bar based on priority
            for (const pId of priorityOrder) {
                if (enabled.includes(pId) && results[pId] && !results[pId].error) {
                    prioritizedProvider = pId;
                    break;
                }
            }

            // 2. Process all enabled providers for tooltip, only the prioritized one for status text
            priorityOrder.forEach(pId => {
                if (enabled.includes(pId)) {
                    processMetric(pId, results[pId]);
                }
            });

            // 3. Update Status Bar Text
            let statusText = prioritizedProvider ? `$(pulse) AI: ${peak5h}%` : `$(circle-slash) AI: N/A`;
            if (peak7d > 0) {
                statusText += `|${peak7d}%`;
            }

            myStatusBarItem.text = statusText;
            myStatusBarItem.tooltip = tooltipLines.join('\n');
            
            const overallMax = Math.max(peak5h, peak7d);
            if (overallMax >= 90) myStatusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
            else if (overallMax >= 70) myStatusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
            else myStatusBarItem.color = undefined;

            myStatusBarItem.show();
            if (logTrigger) outputChannel.appendLine(stdout);
        } catch (e) {
            outputChannel.appendLine(`[Error] Parse failed: ${e.message}`);
        }
    });
}

function deactivate() {
    if (refreshTimer) clearInterval(refreshTimer);
}

module.exports = { activate, deactivate };
