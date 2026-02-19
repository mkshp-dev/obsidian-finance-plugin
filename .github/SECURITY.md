# Security Policy

## Reporting a Vulnerability

The Obsidian Finance Plugin team takes security seriously. We appreciate your efforts to responsibly disclose your findings.

### 🔴 For Critical Security Vulnerabilities

If you discover a **critical security vulnerability** that could:
- Expose user data or financial information
- Allow unauthorized file system access
- Enable command injection or arbitrary code execution
- Compromise user systems

**DO NOT** create a public GitHub issue.

Instead, please report it privately using one of these methods:

1. **Preferred:** Use GitHub's [private security advisory feature](https://github.com/mkshp-dev/obsidian-finance-plugin/security/advisories/new)
2. **Alternative:** Contact the maintainers directly (see contact info in main README.md)

### 🟡 For Non-Critical Security Concerns

For security improvements, best practice suggestions, or lower-severity concerns, you can:
- Use the [Security Issue Template](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/new/choose)
- Open a regular GitHub issue with appropriate context

## What to Include in Your Report

Please provide as much information as possible:

- **Description** of the vulnerability
- **Steps to reproduce** the issue (without publicly sharing exploit code)
- **Potential impact** if exploited
- **Affected versions** (if known)
- **Suggested mitigation** (if you have ideas)

## Response Timeline

We aim to:
- Acknowledge receipt of your report within **48 hours**
- Provide an initial assessment within **7 days**
- Keep you informed of remediation progress
- Credit you in release notes (if desired) once the issue is resolved

## Scope

This security policy covers:
- The Obsidian Finance Plugin codebase
- Direct dependencies with known vulnerabilities
- Issues specific to this plugin's integration with Beancount and Obsidian

Out of scope:
- Vulnerabilities in Obsidian itself (report to Obsidian team)
- Vulnerabilities in Beancount itself (report to Beancount project)
- Issues in third-party dependencies (we'll help route to appropriate projects)

## Security Best Practices for Users

To use this plugin securely:

1. **File Permissions:** Ensure your Beancount files have appropriate permissions
2. **Sensitive Data:** Be cautious about storing highly sensitive information in markdown notes
3. **Backups:** Enable the backup feature in plugin settings
4. **Updates:** Keep the plugin updated to receive security patches
5. **WSL Users:** Be aware of file permission implications when using WSL

## Supported Versions

We provide security updates for:
- Latest stable release
- Previous major version (for critical vulnerabilities)

Older versions may not receive security updates. Please upgrade to the latest version.

## Security Considerations in Plugin Design

This plugin:
- Executes Beancount CLI commands with user-provided file paths
- Performs direct file system operations for CRUD operations
- Does not transmit data over network (all operations are local)
- Uses atomic file writes with optional backup support

Users should be aware that:
- The plugin requires access to your file system where Beancount files are stored
- BQL queries execute with the same privileges as your Beancount installation
- File operations modify your Beancount ledger files directly

## Questions?

If you have questions about this security policy, please open a GitHub Discussion or contact the maintainers.

---

**Thank you for helping keep Obsidian Finance Plugin and its users safe!**
