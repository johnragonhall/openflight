# Agent Runbook — OpenFlight Mobile

This runbook explains how to use the iOS/Android agents and CI for the OpenFlight mobile app.

## Project Overview

- App: **OpenFlight** (`com.openflight.mobile`)
- Mobile code: `mobile/` (Expo managed workflow, EAS Build)
- Agent prompts: `.github/agents/`
- Skills: `.agents/skills/` / `.claude/skills/`

## How to Use the Agents

### Option 1: Claude Code Skills (recommended)

Load a skill in Claude Code and describe the feature you want:

- `/ios-development` — iOS native changes, simulator build, TestFlight prep
- `/android-development` — Android native changes, Gradle build, Play Store prep
- `/mobile-orchestrator` — Coordinate both platforms simultaneously

### Option 2: Agent Prompt Files

Use the prompt files as Claude task templates:

- `.github/agents/ios_agent_prompt.md`
- `.github/agents/android_agent_prompt.md`
- `.github/agents/orchestration_agent_prompt.md`

Fill in the input fields and paste into Claude.

### Option 3: GitHub Issue Label Trigger

1. Create an issue using the Feature Request template (`.github/ISSUE_TEMPLATE/feature_request.md`).
2. Label it `agent/ios` or `agent/android`.
3. The CI will detect the label and can trigger agent workflows.

## CI Setup

### Required GitHub Secrets

Configure these in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Used By | Description |
|--------|---------|-------------|
| `EXPO_TOKEN` | release.yml | EAS Build authentication |
| `APPLE_ID` | release.yml (Fastlane) | Apple ID for signing |
| `FASTLANE_APP_SPECIFIC_PASSWORD` | release.yml (Fastlane) | App-specific password |
| `MATCH_PASSWORD` | release.yml (Fastlane) | Fastlane Match encryption key |
| `MATCH_GIT_URL` | release.yml (Fastlane) | Private repo for Match certs |
| `ANDROID_KEYSTORE_BASE64` | release.yml (Fastlane) | Base64-encoded `.jks` keystore |
| `ANDROID_KEYSTORE_PASSWORD` | release.yml | Keystore password |
| `ANDROID_KEY_ALIAS` | release.yml | Key alias |
| `ANDROID_KEY_PASSWORD` | release.yml | Key password |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | release.yml | Play Console service account |

**Never commit these values to the repo.**

### GitHub Environments

Create two environments in **GitHub → Settings → Environments** with required reviewers:

- `ios-release` — gates the iOS release job
- `android-release` — gates the Android release job

## CI Workflow Summary

### `ci.yml` (runs on every PR and push)

| Job | Platform | Trigger |
|-----|----------|---------|
| install, lint, test-js | Both | Always |
| build-ios-sim | iOS | `ios/**` branches or PRs |
| unit-tests-ios | iOS | After iOS build |
| swiftlint | iOS | `ios/**` branches |
| build-android-debug | Android | `android/**` branches or PRs |
| unit-tests-android | Android | After Android build |
| ktlint | Android | `android/**` branches |
| security-scan | Both | Always |

### `release.yml` (manual trigger only)

Triggered via **GitHub → Actions → Release → Run workflow**.
Requires human approval via GitHub Environments before signing or uploading.

## Branch Naming

| Platform | Pattern |
|----------|---------|
| iOS | `ios/feature/<ticket-id>-<short>` |
| Android | `android/feature/<ticket-id>-<short>` |

## Merge Gates

Before merging any agent PR:

1. All CI checks green
2. At least one human code review approval
3. Signing checklist verified (no secrets in diff)
4. For release PRs: environment approval granted

## Local Development

```bash
cd mobile
npm install

# Start Expo dev server
npm start

# iOS simulator
npm run ios

# Android emulator
npm run android

# Generate native code (needed before native builds)
npx expo prebuild --clean

# EAS cloud build
npx eas-cli build --platform ios --profile development
npx eas-cli build --platform android --profile development
```
