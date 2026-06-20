# Contributing Guide

Thank you for your interest in improving **Anchor Engine**! Below you'll find the workflow we follow to keep code quality high and onboarding smooth.

## How to Submit Changes?
1. Fork this repository and clone locally:
   ```bash
git clone https://github.com/RSBalchII/anchor-engine-node.git
   cd anchor-engine-node
   ```
2. Checkout a new branch with a descriptive name (e.g., `feat/search/token-utils`).
3. Make your changes – run tests locally (`npm test`) and ensure all of them pass.
4. Commit with an *atomic* commit message following our style guide (see below).
5. Push the branch and open a Pull Request against `main`.

## Code Style & Linting
- We use **ESLint** with the Airbnb base configuration plus TypeScript support.
- All files are automatically formatted by **Prettier** on save or via `git commit -S --edit`.
- The CI pipeline runs `eslint . --ext .ts,.tsx` and fails if any lint errors remain.

## Writing Tests
- Our test runner is **Jest** configured in `jest.config.js`.
- For unit‑tests create files under `__tests__/` mirroring the folder structure you’re testing, e.g.:`
  src/services/search/__tests__/search.service.test.ts`
- Aim for at least **70 % coverage** on new/changed code – we generate overall coverage reports as part of every push.

## Documentation Updates
If your change adds a new feature or significantly alters existing behaviour, please update:
- The top‑level README section that covers the feature overview.
- Any relevant API docs (`docs/api/*.md`).
- Add examples to the demo app if applicable.

## Commit Message Conventions
We follow a simplified version of [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) so PR titles look consistent:
```
type(scope): description (optional)
``` 
e.g., `feat(search): add token‑budget support`. If a change touches multiple areas pick one primary type.

## Pull Request Checklist
| Item | Description |
|------|-------------|
| ✅ Code compiles & passes all tests |
| ✅ Linting rules satisfied |
| ✅ Updated documentation present? |
| ✅ No breaking changes unless documented in changelog |
| ✅ CI builds successfully |

> *Feel free to skip any irrelevant items.*
---
