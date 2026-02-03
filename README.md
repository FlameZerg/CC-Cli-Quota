# <img src="https://raw.githubusercontent.com/FlameZerg/CC-Cli-Quota/main/icon.png" width="36" vertical-align="middle"> CC Cli Quota

[![Marketplace](https://img.shields.io/visual-studio-marketplace/v/FlameZerg.cc-cli-quota?style=flat-square&label=Marketplace)](https://marketplace.visualstudio.com/items?itemName=FlameZerg.cc-cli-quota)
[![Open VSX](https://img.shields.io/open-vsx/v/FlameZerg/cc-cli-quota?style=flat-square&label=Open%20VSX)](https://open-vsx.org/extension/FlameZerg/cc-cli-quota)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/FlameZerg.cc-cli-quota?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=FlameZerg.cc-cli-quota)

Monitoring of your AI CLI usage and quotas for **Claude Code, OpenAI Codex, Google Gemini, Z.ai, and OpenRouter**.

## ✨ Key Features

- 📊 **Multi-Provider Monitoring**: Unified tracking for Claude, Codex, Gemini, Z.ai, and OpenRouter.
- 🕒 **Dynamic Refresh**: Intelligent caching with user-configurable refresh intervals (Default: 2 min).
- 🖱️ **Interactive Status Bar**: Dynamic individual status entries for each active provider.
- 🔍 **Detailed Insights**: Instant hover tooltips showing precise usage windows (5h/7d) and exact reset countdowns.
- 🔐 **Secure Credential Management**: Easy API key configuration within VS Code for non-OAuth providers.
- ⚡ **Lightweight & Fast**: Built with performance in mind using a lean Python-based monitoring engine.

## 🚀 Getting Started

### 📦 Installation

1. Install the extension via the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=FlameZerg.cc-cli-quota), [Open VSX Registry](https://open-vsx.org/extension/FlameZerg/cc-cli-quota), or manual `.vsix` file.
2. Ensure **Python 3.x** is installed and available in your system path.

### 🛠️ Configuration

1. **OAuth-based (Claude, Codex, Gemini)**: Ensure you have performed the initial login in your terminal (e.g., `claude login`, `codex login`, `gemini`).
2. **Key-based (Z.ai, OpenRouter)**: Use the **Toggle Providers** menu to securely input your API keys.

## ⌨️ Commands

| Command                | Title                                 | Description                                                                |
| ---------------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| `AI: Toggle Providers` | **$(settings-gear) Toggle Providers** | Adjust active AI providers, set API keys, and configure refresh frequency. |
| `AI: Check Quota`      | **$(search) Check Quota**             | Launch a dedicated terminal to view detailed, color-coded usage logs.      |

> **Tip**: Quickly access the **Toggle Providers** menu by clicking on any AI status item in the status bar.

## 🛠️ System Requirements

- **VS Code**: `^1.90.0`
- **Python**: `3.6+`
- **Platform**: Windows, macOS, Linux
- **Node.js**: `18.x+` (Recommended)

---

## ❤️ Support & Development

Developed by an ordinary college student. If this tool enhances your workflow, we would deeply appreciate your support!

<p align="center">
  <img src="https://raw.githubusercontent.com/FlameZerg/CC-Cli-Quota/main/donation.jpg" width="250" alt="Support Project">
  <br>
  <b>Aptos</b>
</p>
