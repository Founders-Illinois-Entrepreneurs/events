# Founders Tools

Web tools for **Founders · Illinois Entrepreneurs** events, owned by the club's GitHub organization so they stay with the club from one semester to the next.

| App | Folder | Live at | Hosting |
| --- | --- | --- | --- |
| Events (R&D pitch evaluation game) | [`apps/events`](apps/events) | [events.foundersillinois.org](https://events.foundersillinois.org) | Vercel |

The main website, [foundersillinois.org](https://foundersillinois.org), lives in its own repo and is hosted on GitHub Pages.

## How this repo works

- **One repo, one Vercel project per app.** Each folder in `apps/` is its own Vercel project, with its own domain, settings and deploy history. A change inside one folder only redeploys that app.
- **Events are data, not code.** A new event is created from an app's `/admin` page (with **Copy setup from**), so you don't need a new folder or repo per event.
- **A new tool** goes in `apps/<tool>/` once the club depends on it. Experiments can start in your own repo and move here later.
- **Old tools** move to `archive/` with their Vercel project turned off, so the code stays around as a reference.

## Contributing

1. Make a branch, commit, and open a pull request into `main`.
2. CI runs lint, typecheck, tests and a build for the app you changed. One approval is needed to merge.
3. Vercel posts a preview link on the pull request. Merging to `main` deploys to production.

Never commit secrets (`.env.local`, passwords, database URLs) or personal data. This repo is public. Secrets go in the Vercel project's environment variables.

## Adding a new app

1. Create `apps/<tool>/` with its own `package.json`.
2. Add a job for it in [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
3. In Vercel (club account): **Add New → Project**, pick this repo, set **Root Directory** to `apps/<tool>`, and add a domain such as `<tool>.foundersillinois.org`. Then add a CNAME record for it in Namecheap DNS.
4. Add a row to the table above and owners in [`.github/CODEOWNERS`](.github/CODEOWNERS).

## Credits

Thank you to everyone who built these tools. If you contributed, add yourself here in your pull request. A LinkedIn link is optional.

- **Will Garrett** ([GitHub](https://github.com/wgarrett707)): original [investment-game](https://github.com/wgarrett707/investment-game) that the events app grew from.
- **Amey Gupta** ([GitHub](https://github.com/amey-gupt)): events app, R&D pitch evaluation game.
- **Zuyu Liu** ([GitHub](https://github.com/geeeethubb)): events app.
