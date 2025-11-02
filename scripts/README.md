# iOS Development Scripts

Helper scripts to simplify iOS development workflow.

## Scripts

### `ios-build.sh`
Builds the HomeMap app for iOS simulator.

```bash
./scripts/ios-build.sh
```

### `ios-run.sh`
Installs and launches the app on iPad simulator (preserves existing data).

```bash
./scripts/ios-run.sh
```

### `ios-clear-data.sh`
Clears the app's homemapdata folder. Next launch will recreate from template.

```bash
./scripts/ios-clear-data.sh
```

### `ios-rebuild.sh`
Full rebuild: builds, clears data, installs, and launches in one command.

```bash
./scripts/ios-rebuild.sh
```

## Notes

- Scripts automatically find the correct iPad simulator (prefers booted one)
- Container IDs change on reinstall - scripts handle this automatically
- Scripts require iPad Pro 13-inch (M4) simulator to be available
- All scripts should be run from project root or scripts directory

## Typical Workflow

```bash
# First time or major changes
./scripts/ios-rebuild.sh

# Quick iteration (preserves data)
./scripts/ios-build.sh
./scripts/ios-run.sh

# Testing with fresh template
./scripts/ios-clear-data.sh
./scripts/ios-run.sh
```
