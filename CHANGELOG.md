# Changelog

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
