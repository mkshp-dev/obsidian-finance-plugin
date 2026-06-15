---
sidebar_position: 1
---

# Requirements

Before you can use Beancount ledger, you need to set up the underlying Python and Beancount dependencies on your machine. This guide covers the required software and how to install them on any major operating system.

---

## 📋 System Prerequisites

The plugin requires the following command-line tools to be available:

1.  **Python 3.8 or newer**: The runtime environment for executing Beancount.
2.  **Beancount v3 or newer**: The main plain-text accounting engine.
3.  **bean-query**: The query tool for BQL execution. *Note: Starting with Beancount v3, beanquery is distributed as a separate package and must be installed explicitly.*
4.  **bean-price** *(Optional)*: The automated price-fetching tool. Distributed as `beanprice`.

---

## 💻 OS-Specific Installation Guide

Select the instructions corresponding to your operating system below:

### Windows

1.  **Install Python**: Download and run the installer from the [official Python downloads page](https://www.python.org/downloads/windows/). 
    > [!IMPORTANT]
    > During installation, make sure to check the box **"Add Python.exe to PATH"**.
2.  **Install Beancount, bean-query, and beanprice**: Open PowerShell or Command Prompt and run:
    ```powershell
    pip install beancount beanquery beanprice
    ```
3.  **Verify Installation**:
    ```powershell
    python --version
    bean-check --version
    bean-query --version
    bean-price --version
    ```
    If any commands are not found, ensure that Python's script directory (usually `C:\Users\<YourUsername>\AppData\Local\Programs\Python\Python3X\Scripts\`) is in your system's PATH environment variable, then restart Obsidian.

---

### macOS

1.  **Install Homebrew**: If you don't have Homebrew, install it from [brew.sh](https://brew.sh).
2.  **Install Python**: Open Terminal and run:
    ```bash
    brew install python
    ```
3.  **Install Beancount dependencies**: Run the following pip command:
    ```bash
    pip3 install beancount beanquery beanprice
    ```
4.  **Verify Installation**:
    ```bash
    python3 --version
    bean-check --version
    bean-query --version
    bean-price --version
    ```

---

### Linux (Debian / Ubuntu / Fedora / Arch)

1.  **Install Python and Pip**:
    *   **Debian/Ubuntu**:
        ```bash
        sudo apt update
        sudo apt install python3 python3-pip python3-venv
        ```
    *   **Fedora**:
        ```bash
        sudo dnf install python3 python3-pip
        ```
    *   **Arch Linux**:
        ```bash
        sudo pacman -S python python-pip
        ```
2.  **Install Beancount packages**:
    ```bash
    pip3 install beancount beanquery beanprice
    ```
3.  **Verify Installation**:
    ```bash
    python3 --version
    bean-check --version
    bean-query --version
    bean-price --version
    ```

---

### WSL (Windows Subsystem for Linux)

If you prefer to run Beancount inside WSL:
1.  Open your WSL terminal (e.g. Ubuntu).
2.  Install Python and pip:
    ```bash
    sudo apt update
    sudo apt install python3 python3-pip
    ```
3.  Install the required Beancount tools:
    ```bash
    pip3 install beancount beanquery beanprice
    ```
4.  The plugin will automatically detect WSL on startup and run commands through `wsl <command>`. Ensure that your vault and files are accessible within WSL (e.g., located under `/mnt/c/Users/...`).
