# 🎮 Picknickers Hub

> Your online headquarters for multiplayer game nights — free, no sign-up, open source.

**Live site:** https://picknickershub.github.io

---

## Project Structure

```
picknickershub/
├── index.html              # Home / lobby page
├── 404.html                # Custom 404 page
├── css/
│   └── style.css           # All styles (design tokens, components, pages)
├── js/
│   └── main.js             # All JS (nav, game cards, leaderboard, forms)
├── pages/
│   ├── leaderboard.html    # Full leaderboard page
│   ├── about.html          # About page
│   └── privacy.html        # Privacy policy
├── games/                  # Each game lives in its own sub-folder (added later)
│   └── (future games here)
└── .github/
    └── workflows/
        └── deploy.yml      # Auto-deploy to GitHub Pages on push to main
```

---

## Running Locally

No build step required. Open `index.html` directly in a browser, **or** use a local
dev server to avoid any path issues:

```bash
# Option A — Python (ships with macOS/Linux, available on Windows)
python -m http.server 8080
# then visit http://localhost:8080

# Option B — Node (if installed)
npx serve .
# then visit http://localhost:3000

# Option C — VS Code Live Server extension
# Right-click index.html → "Open with Live Server"
```

---

## Adding a New Game

1. Create a folder: `games/your-game-name/`
2. Add your game files (`index.html`, etc.) inside that folder.
3. Open `js/main.js` and find the `GAMES` array at the top.
4. Add an entry like this:

```js
{
  id: 'your-game-name',
  title: 'Your Game Title',
  description: 'Short description shown on the card.',
  emoji: '🎯',
  bgColor: '#1a1a2a',   // card thumbnail background colour
  category: 'card',     // one of: card | board | word | trivia
  players: '2–6',
  comingSoon: false,     // set to false once the game is ready
  url: 'games/your-game-name/index.html',
},
```

5. Commit and push — the CI workflow deploys automatically.

---

## Deployment (GitHub Pages)

Deployment is fully automated via `.github/workflows/deploy.yml`.

**One-time setup:**

1. Push this repo to GitHub under the org/user `picknickershub`.
2. In the repo settings → **Pages** → set Source to **GitHub Actions**.
3. Every push to `main` triggers a deployment.
4. The site will be live at `https://picknickershub.github.io`.

### Custom Domain (optional, free with GitHub Pages)

1. Buy a domain (e.g., `picknickershub.com` from Namecheap/Porkbun ~$10/yr).
2. In repo **Settings → Pages → Custom domain**, enter your domain.
3. At your DNS registrar, add these records:
   ```
   A     @   185.199.108.153
   A     @   185.199.109.153
   A     @   185.199.110.153
   A     @   185.199.111.153
   CNAME www picknickershub.github.io.
   ```
4. Enable **Enforce HTTPS** in Pages settings (free SSL via Let's Encrypt).

For a completely free subdomain: the default `picknickershub.github.io` URL works out of the box — no domain purchase needed.

---

## Tech Stack

| Layer   | Choice                  | Why                              |
|---------|-------------------------|----------------------------------|
| HTML    | HTML5 (semantic)        | No build step, max compatibility |
| CSS     | Custom CSS (vars)       | No framework overhead            |
| JS      | Vanilla ES2020          | Zero dependencies                |
| Hosting | GitHub Pages            | Free, HTTPS, custom domain       |
| CI/CD   | GitHub Actions          | Auto-deploy on push              |

---

## Contributing

1. Fork the repo.
2. Create a branch: `git checkout -b feature/my-game`.
3. Make your changes.
4. Open a pull request — describe the game or change briefly.

All skill levels welcome. Games can be anything — simple HTML/JS games work perfectly.

---

## License

MIT — free to use, modify, and redistribute.
