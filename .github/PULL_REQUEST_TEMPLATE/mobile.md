# Mobile PR

## Summary of Changes

## Related Issue

Closes #

## Branch Name

## Files Changed

## Test Plan

How to reproduce locally:

1.
2.
3.

## CI Results Summary

| Check | Status | Notes |
|-------|--------|-------|
| JS tests | | |
| iOS simulator build | | |
| iOS XCTest | | |
| Android debug build | | |
| Android unit tests | | |
| SwiftLint / ktlint | | |
| Security scan | | |

## Screenshots

| Before | After |
|--------|-------|
| | |

## Security and Privacy Impact

- [ ] No security or privacy impact
- [ ] Yes — describe:

## Signing / Keystore Checklist

### iOS

- [ ] No `.p12`, `.mobileprovision`, or API keys committed
- [ ] Info.plist changes reviewed by human
- [ ] Entitlements changes reviewed by human
- Bundle ID: `com.openflight.mobile`

### Android

- [ ] No `.jks`, `.keystore`, or service account JSON committed
- [ ] `build.gradle` signing config uses CI secret name references only
- Package: `com.openflight.mobile`

## Reviewer Checklist

- [ ] Lint passes
- [ ] All CI checks green
- [ ] Build succeeds on simulator/emulator
- [ ] Test plan followed manually (for UI changes)
- [ ] Signing checklist verified (no secrets in diff)
- [ ] No iOS files modified in an Android-only PR (and vice versa)
