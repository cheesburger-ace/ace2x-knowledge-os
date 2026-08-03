# ACE2X Knowledge OS
Transforming Information into Organizational Intelligence
ACE2X Knowledge OS is an Obsidian plugin that synchronizes decisions, risks, issues, executive follow-ups, people references, inline statuses, and a native Obsidian Bases dashboard.
Knowledge OS is an knowledge management framework for Obsidian that combines structured metadata, AI-assisted knowledge capture, dashboards, and organizational relationships to create a living operational knowledge system.

## Features

• AI meeting processing

• Metadata synchronization

• Decision management

• Risk management

• Executive dashboards

• Knowledge graph optimization

• Dataview integration

• Native due-date capture for records and personal tasks (no Tasks plugin required)

• Templater integration

• Organizational intelligence

Documentation

→ Product Guide

→ Installation Guide

→ User Guide

→ Architecture

→ Roadmap

## Dependencies

ACE2X Knowledge OS is designed to work with several excellent Obsidian community plugins. Three plugins are required for full functionality, while several others are recommended to enhance the overall experience.

### Required Community Plugins

| Plugin | Purpose |
|---------|---------|
| **Dataview** | Metadata queries, dashboards, reporting, and dynamic views |
| **Templater** | Automated note creation, templates, and workflows |
| **Meta Bind** | Interactive dashboards, forms, and metadata editing |

> Personal `- [ ]` checkboxes are native Obsidian markdown — no plugin required. Due dates on both record lines (`d::`/`r::`/`i::`/`e::`/`a::`) and personal task lines are handled natively by ACE2X's own `[due:: ]` suggest (type `[` on either kind of line). The Tasks community plugin is no longer required; if you were using its global task query, see the syntax reference in ACE2X settings for a Dataview `TASK` query equivalent.

> [!IMPORTANT]
> These plugins should be installed and enabled for ACE2X Knowledge OS to function as designed.

### Recommended Community Plugins

| Plugin | Purpose |
|---------|---------|
| **Copilot** | AI-assisted meeting processing and knowledge capture |
| **QuickAdd** | Rapid note capture and workflow automation |
| **Omnisearch** | Enhanced vault search |
| **Calendar** | Daily note navigation |
| **Periodic Notes** | Daily, weekly, monthly, and yearly note management |
| **Excalidraw** | Diagrams, architecture, and visual knowledge mapping |
| **Commander** | Custom commands and ribbon buttons |
| **Style Settings** | Optional appearance customization |

### Platform Requirements

- Obsidian (latest stable version recommended)
- Community Plugins enabled
- Local vault (recommended)
- Git or GitHub (optional, recommended for version control)

### AI Compatibility

ACE2X Knowledge OS is AI-provider agnostic. The included prompts and workflows can be used with:

- OpenAI ChatGPT
- Anthropic Claude
- Google Gemini
- Ollama (local models)
- LM Studio (local models)

### Environment Validation

Beginning with **v0.5.0**, ACE2X includes an **Environment Validator** that verifies:

- Required plugins are installed and enabled.
- Configured folders exist.
- Plugin settings are complete.

The validator does **not** require a specific folder structure. Users are free to organize their vault however they choose and simply map folders within the ACE2X settings.
ACE2X Knowledge OS is an Obsidian plugin that synchronizes decisions, risks, issues, executive follow-ups, people references, inline statuses, and a native Obsidian Bases dashboard.

## Current release

**0.5.0**

## Development

Requirements: Node.js 18 or newer and npm.

```bash
npm install
npm run dev
```

`npm run dev` watches `src/main.ts` and rebuilds `main.js` when the source changes.

## Production build

```bash
npm install
npm run build
```

The build writes the distributable plugin to `main.js`. An Obsidian installation requires:

- `main.js`
- `manifest.json`
- `styles.css`

## Versioning

Update the version in `package.json`, then run:

```bash
npm version patch
```

The version script synchronizes `manifest.json` and `versions.json`.
