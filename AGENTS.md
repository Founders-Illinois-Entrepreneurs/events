# Notes for coding agents

- This is a monorepo. Each app in `apps/` is a separate project with its own `package.json`, `node_modules` and `AGENTS.md`. Run npm commands inside the app's folder, never at the repo root.
- Read the app's own `README.md` and `AGENTS.md` before changing it.
- Apps don't import from each other. Copy a pattern instead of creating a cross-app dependency.
- The main website (foundersillinois.org) is a separate repo: https://github.com/Founders-Illinois-Entrepreneurs/founders-website. To use it as context, clone it next to this repo.
- The repo is public: never commit secrets or personal data.
