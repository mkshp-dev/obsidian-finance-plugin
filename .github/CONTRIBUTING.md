# Contributing to Obsidian Finance Plugin

Thank you for your interest in contributing! This document provides guidelines and information for contributing to the Obsidian Finance Plugin.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Submitting Changes](#submitting-changes)
- [Issue and PR Labels](#issue-and-pr-labels)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** (v7 or higher)
- **Python** (3.7 or higher)
- **Beancount** (2.3 or higher)
- **Obsidian** (latest version recommended)
- **Git**

### Understanding the Architecture

Before contributing, please review:
- [README.md](../README.md) - Overall project documentation
- [.github/copilot-instructions.md](.github/copilot-instructions.md) - Detailed architecture guide
- The codebase structure in [src/](../src/)

**Key architectural points:**
- TypeScript + Svelte frontend
- Direct Beancount CLI integration (no backend server)
- Controller pattern for dashboard tabs
- Service layer for business logic
- Direct file operations with atomic writes

## Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR-USERNAME/obsidian-finance-plugin.git
cd obsidian-finance-plugin
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Plugin

```bash
# Development build with watch mode
npm run dev

# Production build
npm run build
```

### 4. Test in Obsidian

1. Create a symbolic link or copy the plugin folder to your Obsidian vault:
   ```
   <vault>/.obsidian/plugins/obsidian-finance-plugin/
   ```

2. In Obsidian:
   - Settings → Community Plugins
   - Reload the plugin
   - Enable "Obsidian Finance Plugin"

3. Enable debug mode in plugin settings for detailed console logs

### 5. Set Up Test Environment

- Create a test Beancount file or use [demo-ledger.ts](../src/services/demo-ledger.ts)
- Configure the plugin to point to your test file
- Run connection tests in Settings → Connection tab

## How to Contribute

### Reporting Bugs

Use the [Bug Report template](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/new/choose) and include:
- Clear description
- Steps to reproduce
- Expected vs. actual behavior
- Environment details (OS, Obsidian version, plugin version)
- Console logs (enable debug mode first)

### Requesting Features

Use the [Feature Request template](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/new/choose) and provide:
- Problem statement
- Proposed solution
- Use case examples
- Mockups or examples (if applicable)

### Contributing Code

1. **Check for existing issues** - Look for related issues or create one
2. **Discuss your approach** - Comment on the issue to discuss implementation
3. **Fork and branch** - Create a feature branch from `master`
4. **Make changes** - Follow coding standards (see below)
5. **Test thoroughly** - Test on multiple platforms if possible
6. **Submit PR** - Use the PR template and link related issues

### Contributing Documentation

- README improvements
- Code comments
- Example queries
- Architecture documentation
- User guides

Documentation contributions are highly valuable!

## Coding Standards

### TypeScript

- **Formatting:** Follow existing code style (ESLint config)
- **Types:** Use explicit types, avoid `any` when possible
- **Naming:**
  - PascalCase for classes, interfaces, types
  - camelCase for functions, variables
  - UPPER_SNAKE_CASE for constants
- **Comments:** Add JSDoc comments for public APIs
- **Imports:** Use absolute imports from `src/`

### Svelte

- **Components:** One component per file
- **Props:** Use TypeScript for prop types
- **Stores:** Use Svelte stores for reactive state
- **Events:** Use `createEventDispatcher` for custom events
- **Styles:** Scoped to component, use CSS variables from tokens

### File Organization

```
src/
├── controllers/      # Dashboard tab controllers
├── models/          # Data models and types
├── queries/         # BQL query builders
├── services/        # Business logic services
├── stores/          # Svelte stores
├── ui/
│   ├── common/      # Reusable UI components
│   ├── modals/      # Modal components
│   ├── partials/    # Dashboard tabs and settings
│   └── views/       # Obsidian views
├── utils/           # Utility functions
└── main.ts          # Plugin entry point
```

### Key Patterns

1. **Controller Pattern:**
   ```typescript
   export class MyController {
     state = writable<State>(initialState);
     
     async fetchData() {
       // Use services/utils
     }
   }
   ```

2. **Service Pattern:**
   ```typescript
   export class MyService {
     async getData(plugin: Plugin) {
       return await runQuery(plugin, query);
     }
   }
   ```

3. **File Operations:**
   - Use functions from `utils/index.ts`
   - Always use atomic writes
   - Respect backup settings
   - Handle errors gracefully

4. **BQL Queries:**
   - Use `runQuery()` from `utils/index.ts`
   - Parse CSV output properly
   - Handle empty results
   - Add error handling

### Logging

```typescript
import { Logger } from './utils/logger';

Logger.log('Info message');
Logger.warn('Warning message');
Logger.error('Error message');
```

Enable debug mode in settings to see logs.

## Testing Guidelines

### Manual Testing Checklist

- [ ] Test on Windows, macOS, or Linux
- [ ] Test with WSL (if Windows)
- [ ] Test connection settings
- [ ] Test BQL code blocks and inline queries
- [ ] Test CRUD operations (create, read, update, delete)
- [ ] Test each dashboard tab
- [ ] Check console for errors (Ctrl+Shift+I / Cmd+Option+I)
- [ ] Test with backups enabled/disabled
- [ ] Test with large Beancount files
- [ ] Test error handling (invalid paths, syntax errors, etc.)

### Cross-platform Considerations

- **Path handling:** Use `SystemDetector` for environment detection
- **WSL:** Test path conversions with `convertWslPathToWindows()`
- **Commands:** Test `python3` vs `python` vs `py`
- **Line endings:** Handle both CRLF and LF

### Performance Testing

- Test with large Beancount files (10k+ transactions)
- Monitor CPU and memory usage
- Check query execution times
- Test UI responsiveness

## Submitting Changes

### Branch Naming

- `feat/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation
- `refactor/description` - Code refactoring
- `perf/description` - Performance improvements
- `test/description` - Test additions

### Commit Messages

Follow conventional commits:

```
type(scope): brief description

Longer description if needed

Fixes #123
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

Examples:
- `feat(dashboard): add commodity price chart`
- `fix(bql): handle empty query results`
- `docs(readme): update installation instructions`

### Pull Request Process

1. **Update your fork:**
   ```bash
   git fetch upstream
   git rebase upstream/master
   ```

2. **Create PR** using the PR template

3. **Address review feedback** promptly

4. **Keep PR focused** - One feature/fix per PR

5. **Update CHANGELOG.md** (if applicable)

### PR Review Criteria

- Code quality and style
- Test coverage
- Documentation updates
- No console errors
- Builds successfully
- Follows architectural patterns

## Issue and PR Labels

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Documentation improvements
- `performance` - Performance issues
- `question` - Further information requested
- `setup` - Installation/configuration issues
- `security` - Security issues
- `needs-triage` - Needs initial review
- `good-first-issue` - Good for newcomers
- `help-wanted` - Extra attention needed
- `wontfix` - Will not be addressed
- `duplicate` - Already reported

## Getting Help

- **Questions:** Use [GitHub Discussions](https://github.com/mkshp-dev/obsidian-finance-plugin/discussions)
- **Setup Issues:** Use the [Setup Help template](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/new/choose)
- **General Bugs:** Use the [Bug Report template](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/new/choose)

## Development Tips

1. **Use TypeScript:** Let the type system catch errors early
2. **Test frequently:** Reload the plugin often during development
3. **Check console:** Enable debug mode and monitor console logs
4. **Follow patterns:** Look at existing controllers/services for examples
5. **Ask questions:** Comment on issues if you need clarification

## Code Review

We review all PRs for:
- Correctness
- Code quality
- Performance
- Security
- User experience
- Documentation

Reviews may take a few days. Be patient and responsive to feedback.

## Recognition

Contributors are recognized in:
- Release notes
- README contributors section (if we add one)
- GitHub contributor stats

## Questions?

Feel free to:
- Open a GitHub Discussion
- Comment on related issues
- Reach out to maintainers

---

**Thank you for contributing to making financial tracking better in Obsidian!** 🚀
