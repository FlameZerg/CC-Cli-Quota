# Changelog

## [1.1.8]

### Fixed

- **Gemini Display**: Fixed an aggregation logic bug where the status bar would display the most abundant remaining quota instead of the most depleted one, ensuring accurate tracking for multi-model users.

### Changed

- **Display Default Flip**: Inverted the core logic so the default display mode (unchecked) is now purely descending (100% = Full Quota, 0% = Empty). The configuration flag `cclimits.reverseDisplay` now acts to toggle back to the legacy ascending mode.

### Fixed

- **Usage Display**: Fixed a bug where a 0% 7-day usage (or exhausted quota in reversed mode) would cause the 7-day quota indicator to disappear from the status bar.
- **Codex Display**: Corrected Codex window label rendering in extension tooltip that staticly stamped `(5h)` and `(7d)` despite free boundaries dynamically varying (e.g. `(168h)`).

## [1.1.5]

### Added

- **Reverse Display Mode**: Added a toggle option in `AI:Toggle Providers` to switch percentage displays between "0%=Full" and "100%=Full".

## [1.1.4]

### Fixed

- **Improved Reliability**: Implemented smart, granular retry logic. If an update partially fails, only the failed providers are retried after 10 seconds, preserving successful data from other providers.
- **Enhanced Persistence**: Existing status information is now preserved during network errors, preventing the "AI: Off" state unless no data is available at all.

## [1.1.2]

### Fixed

- Fixed QuickPick selection state persistence for API Keys and Refresh Interval.

## [1.1.1]

### Fixed

- Resolved a critical `ReferenceError` that prevented the automatic refresh timer from starting.
- Improved configuration synchronization; the refresh interval now updates immediately when changed in VS Code settings.

### Enhanced

- Added explicit Node.js and Platform requirements to documentation.
