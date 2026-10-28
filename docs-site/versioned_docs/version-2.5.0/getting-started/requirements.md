---
sidebar_position: 1
---

# Requirements

Before you can use Beancount Ledger, you need to set up the underlying Python and Beancount dependencies on your machine. This guide covers the required software and how to install them on any major operating system.

:::important Desktop only
Beancount Ledger requires a local Python installation and is not available on Obsidian mobile (iOS/Android).
:::

---

## 📋 System Prerequisites

The plugin requires the following command-line tools to be available:

1. **Python 3.8 or newer**: The runtime environment for executing Beancount.
2. **Beancount v3 or newer**: The main plain-text accounting engine.
3. **bean-query** (via `beanquery`): **Required**. The query tool for BQL execution. Starting with Beancount v3, `beanquery` is distributed as a separate package and must be installed explicitly.
4. **bean-price** (via `beanprice`): *(Optional)*. The automated price-fetching tool.

---

## 💻 OS-Specific Installation Guide

Select the instructions corresponding to your operating system below:

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="windows" label="Windows" default>

### Step 1: Install Python

Download and run the installer from the [official Python downloads page](https://www.python.org/downloads/windows/).

:::important
During installation, make sure to check the box **"Add Python.exe to PATH"**.
:::

### Step 2: Install beancount and tools

Open PowerShell or Command Prompt and run:
```powershell
pip install beancount beanquery beanprice
```

### Step 3: Verify installation

Run in PowerShell:
```powershell
bean-query --version
```
If this succeeds, you can use `bean-query` directly in the plugin's onboarding wizard or settings.

If you need the full path, run:
```powershell
Get-Command bean-query | Select-Object -ExpandProperty Source
```
Example path: `C:\Users\<YourUsername>\AppData\Local\Programs\Python\Python3X\Scripts\bean-query.exe`

:::tip WSL Users
If you prefer running Beancount inside Windows Subsystem for Linux (WSL), install Beancount inside your WSL distribution and set your command in Obsidian to `wsl bean-query`.
:::

### Step 4: Configure in Obsidian

In the Onboarding wizard (Step 1: Connect) or **Settings → Connection**, enter `bean-query` (or the full `.exe` path) and click **Verify**.

  </TabItem>
  <TabItem value="macos" label="macOS">

### Step 1: Install Python (via Homebrew or Python.org)

If using Homebrew:
```bash
brew install python
```

### Step 2: Install beancount and tools

Open Terminal and run:
```bash
pip3 install beancount beanquery beanprice
```

### Step 3: Find the binary path

```bash
which bean-query
```
Output is typically `/Users/<username>/.local/bin/bean-query` or `/opt/homebrew/bin/bean-query`.

:::important GUI App PATH Note
macOS GUI applications like Obsidian do not automatically inherit shell `PATH` customizations from `~/.zshrc` or `~/.bash_profile`. If auto-detection fails in Obsidian, enter the full path (e.g., `/Users/<username>/.local/bin/bean-query`).
:::

### Step 4: Configure in Obsidian

In the Onboarding wizard (Step 1: Connect) or **Settings → Connection**, enter your full path and click **Verify**.

  </TabItem>
  <TabItem value="linux-native" label="Linux (AppImage / Deb)">

### Step 1: Install Python and Pip

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv
```

**Fedora/RHEL:**
```bash
sudo dnf install python3 python3-pip
```

**Arch:**
```bash
sudo pacman -S python python-pip
```

### Step 2: Install beancount and tools (via Pip)

```bash
pip install --user beancount beanquery beanprice
```

:::note System Packages Note
Installing Beancount directly via `apt`, `dnf`, or `pacman` often installs Beancount v2. You must install `beanquery` separately via `pip` to get `bean-query`.
:::

### Step 3: Verify & Configure

1. Check location: `which bean-query` (usually `~/.local/bin/bean-query`).
2. Open Obsidian Onboarding (Step 1: Connect) or **Settings → Connection**.
3. Enter `bean-query` or the full path and click **Verify**.

  </TabItem>
  <TabItem value="linux-sandbox" label="Linux (Flatpak / Snap)">

:::note Sandboxed Application Access
Sandboxed packages like Flatpak cannot see your host system's binaries by default. Follow these steps to grant Obsidian access to `bean-query`.
:::

### Flatpak Setup (Recommended)

1. **Install tools on host machine:**
   ```bash
   pip install --user beancount beanquery beanprice
   ```
2. **Find binary folder directory:**
   ```bash
   which bean-query
   ```
   *Note the directory containing `bean-query` (e.g., if output is `~/.local/bin/bean-query`, the folder is `~/.local/bin`).*

3. **Grant filesystem access via `flatpak override`:**
   ```bash
   sudo flatpak override --filesystem=~/.local/bin md.obsidian.Obsidian
   ```
   *(Replace `~/.local/bin` with your actual folder if using conda or custom paths).*

4. **Restart Obsidian completely** to apply the new sandbox permissions.

5. **Configure & Verify:** In Onboarding Step 1 (Connect) or **Settings → Connection**, enter the full path (e.g., `/home/username/.local/bin/bean-query`) and click **Verify**.

### Snap Setup

1. Find the host binary path: `which bean-query`.
2. Enter the full path in Onboarding Step 1 / Settings.
3. *Note:* If Snap strict confinement blocks host execution, switch to the official Obsidian AppImage or Flatpak release.

  </TabItem>
  <TabItem value="wsl" label="WSL">

### Step 1: Open WSL Terminal

Open your WSL terminal (e.g., Ubuntu on Windows).

### Step 2: Install Python & Beancount inside WSL

```bash
sudo apt update
sudo apt install python3 python3-pip
pip3 install beancount beanquery beanprice
```

### Step 3: Verify inside WSL

```bash
bean-query --version
```

### Step 4: Configure Obsidian

In Obsidian Onboarding (Step 1: Connect) or **Settings → Connection**:
- Set the command to: `wsl bean-query`
- Click **Verify**.

:::important Vault Location
Ensure your vault files are accessible from WSL (e.g. located under `/mnt/c/Users/...`).
:::

  </TabItem>
</Tabs>
