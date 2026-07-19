# Source Reconstruction Notes

The original repository contained the distributable JavaScript plugin but not its TypeScript development project.

For version 0.4.12, `src/main.ts` was reconstructed directly from the readable distributable `main.js` so that current behavior could be preserved while establishing a maintainable build process.

The source currently uses `// @ts-nocheck` because the original implementation was JavaScript and did not contain TypeScript annotations. This allows the reconstructed source to build without changing runtime behavior. Future revisions can incrementally add interfaces and strict typing.

The production build was validated with:

```bash
npm install
npm run build
```
