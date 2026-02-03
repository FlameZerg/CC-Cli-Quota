# Changelog

All notable changes to the "cc-cli-quota" extension will be documented in this file.

## [1.1.1] - 2026-02-03

### Fixed

- Resolved a critical `ReferenceError` that prevented the automatic refresh timer from starting.
- Improved configuration synchronization; the refresh interval now updates immediately when changed in VS Code settings.

### Enhanced

- Added explicit Node.js and Platform requirements to documentation.
