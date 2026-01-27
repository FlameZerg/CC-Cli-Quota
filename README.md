# CC Cli Quota

Monitor your AI CLI quotas and refresh time (Claude, Codex, Gemini, Z.ai, Openrouter) in the status bar.

## Features

- **Real-time Monitoring**: Displays peak usage for both 5-hour and 7-day windows in the status bar (e.g., `12%|5%`).
- **Support for Multiple Providers**: Monitor Claude Code, OpenAI Codex, Google Gemini, Z.ai, and Openrouter.
- **Detailed Insights**: Hover over the status bar to see specific percentages and "Resets in" times for each model.
- **Self-Contained**: Includes the `cclimits.py` monitoring engine internally.
- **Smart Caching**: Automatically refreshes every 2 minutes with intelligent caching to minimize network overhead.
- **Customizable**: Toggle specific providers on/off via the status bar click menu.

## Usage

1. **Install**: Install the `.vsix` file in VS Code.
2. **Setup**: Ensure you are logged into your respective AI CLIs (e.g., `claude login`, `codex login`).
3. **Configure**: Click the status bar item to toggle which providers you want to monitor.
4. **Manual Refresh**: Run `AI: Check Quota` from the command palette to force a refresh and see detailed logs.

## Requirements

- Python 3.x installed and available in your PATH.
- Respective AI CLI credentials configured locally.

---

_Created for efficient AI workflow monitoring._

## 🚀 Support & Encouragement

Made by college students, If you find this tool helpful, please consider supporting the project! Your support is a huge motivation for continued maintenance and optimization. Thank you so much!

<p align="center">
  <img src="https://raw.githubusercontent.com/FlameZerg/CC-Cli-Quota/main/donation.jpg" alt="Donation QR Code">
  <br>
  Aptos
</p>
