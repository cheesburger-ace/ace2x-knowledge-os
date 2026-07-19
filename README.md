# ACE2X Knowledge OS

ACE2X Knowledge OS is an Obsidian plugin that synchronizes decisions, risks, issues, executive follow-ups, people references, inline statuses, and a native Obsidian Bases dashboard.

## Current release

**0.4.12**

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
