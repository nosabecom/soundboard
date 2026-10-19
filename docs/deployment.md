# Deployment

The app lives in the private GitHub repository `nosabecom/soundboard` and the Vercel project `soundboard` (team `nomokaro625-9385s-projects`). Its production build serves `dist/soundboard` at `/soundboard/`.

The existing `portfolio` Vercel project owns `nosa.dev`. A project-level external rewrite forwards `/soundboard/:path*` to the soundboard project's production alias, keeping the path. No portfolio content or build needs to change. The route applies to future portfolio deployments too.

Route operations:

```sh
vercel routes list --project portfolio
vercel routes inspect 'Soundboard' --project portfolio
```

Vercel is connected to the private GitHub repository. Pushes to `main` deploy the app. A manual deployment is also supported:

```sh
pnpm check
pnpm build
vercel --prod --yes
```

The website itself is public, so it opens directly on iPad. Repository visibility remains private. The app has no server secrets and stores only layout/settings on the device. `.env*`, `.vercel`, and `.venv` are excluded from Git. Never commit Vercel credentials or local environment files.

For each source update, increment the `CACHE` version in `public/sw.js`, then build and deploy. The worker precaches the shell and all 16 Earshot WAVs; it activates only after the complete shell is stored successfully. It never claims other paths or removes unrelated caches. Existing installed clients fetch the updated worker on reopening; refresh after the new worker activates to load the updated shell.
