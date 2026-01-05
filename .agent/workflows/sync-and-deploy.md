---
description: how to sync changes and deploy to Trigger.dev
---

// turbo

1. PUSH TO GITHUB
   Always ensure local changes are committed and pushed to GitHub main.

```powershell
git add .
git commit -m "your message"
git push origin main
```

2. DEPLOY TO TRIGGER.DEV
   Always deploy to Trigger.dev Cloud immediately after pushing to GitHub to ensure production parity.
   // turbo

```powershell
npx trigger.dev@latest deploy --profile production --skip-update-check
```

3. VERIFY
   Check the Trigger.dev dashboard for the new version number and successful task indexing.
