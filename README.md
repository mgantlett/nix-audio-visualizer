# 🎛️ Nix Audio Visualizer

Welcome to the **Nix Audio Visualizer** codebase. This project provides a powerful, Nix-native audio visualization suite integrated with the **Agile Development OS (ADO-Core)** for governance, observability, and deterministic workflow enforcement.

---

## 🚀 Installation Guide

Follow these steps to clone, initialize the submodules, and bootstrap the development environment.

### 📋 Prerequisites

Before setting up, ensure you have the following installed on your POSIX/Linux system (or WSL):

- **Git** (v2.25+)
- **Bash** (v4.0+)
- **Nix** (Optional but highly recommended for reproducible environment packages)
- **jq** (Required by `ado-core` for manifest and state parsing)
  - Ubuntu/Debian: `sudo apt-get install jq`
  - macOS: `brew install jq`

---

### 📦 Step 1: Clone the Repository

Clone this repository along with its submodules recursively:

```bash
# Clone recursively to automatically pull the .ado-core submodule
git clone --recursive git@github.com:mgantlett/nix-audio-visualizer.git
cd nix-audio-visualizer
```

#### 🔄 If Already Cloned (Without Submodules)

If you have already cloned the repository without using the `--recursive` flag, initialize and update the submodule manually:

```bash
git submodule update --init --recursive
```

---

### ⚡ Step 2: Bootstrap Agile Development OS

Once the submodule is present under `.ado-core/`, run the installer to link the deterministic engine wrappers and semantic playbooks into your workspace:

```bash
bash .ado-core/install.sh
```

#### 🛠️ Interactive Installation
By default, the installer will launch an interactive wizard to configure your:
1. **Task Tracker** (e.g., GitHub, Jira, Sophia)
2. **Git Engine** (e.g., GitHub, GitLab)
3. **Tracking URLs** for cross-linking tickets to commits.

#### 🤖 Silent/Automated Installation
For non-interactive setups (CI/CD, containers, or scripting), you can pass bypass flags:

```bash
# Example silent setup using GitHub tracker & GitHub repository hooks
bash .ado-core/install.sh --task github --git github
```

---

### 🛸 Step 3: Nix Development Environment

If you have Nix installed, launch the reproducible shell environment to auto-load all dependencies, compiler tools, and path environments:

```bash
nix-shell
```

---

## 🤖 Agile Lifecycle with ADO-Core

Once bootstrapped, **Agile Development OS** runs natively in your repository. It enforces the **Definition of Done** (DoD) via the `bin/agent` CLI.

Here are the key commands and workflows:

| Workflow Verb | Purpose | Command / Action |
| :--- | :--- | :--- |
| **`/context-handshake`** | Align workspace context, specs, and environment variables | `bin/agent update` |
| **`/start`** | Groom tasks, assign story points, and claim a branch | Auto-handled via ticketer |
| **`/verify`** | Run linters, test suites, and visual audits locally | `bin/agent verify` |
| **`/commit`** | Compose semantic Git commits using GitBrain history | `bin/agent commit` |
| **`/push`** | Enforce DoD and push commits to `develop` trunk | `bin/agent push` |

### 🔒 Zero-Bypass TDD Guardrails
The ADO-Core runner enforces that all logic modifications must have corresponding test coverage and passes lint checks before code can be pushed to the remote repository. 

---

## 🌐 Community & Support

- Join the **[Sophia Labs Discord Community](https://discord.gg/sophialabs)** to watch Sophia (our senior agent reference model) run live, or ask questions in `#ado-core-help`.
- Refer to `.ado-core/README.md` for the complete documentation on the dual-engine architecture, telemetry pipelines, and GitBrain hooks.
