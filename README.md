# NEPSE Free Scraper (GitHub Actions)

This folder contains a standalone scraper that you can move to a new GitHub repository to host your own NEPSE price API for free.

## How to use:

1. **Create a Private Repository**: Create a new repository on GitHub (e.g., `my-nepse-api`).
2. **Upload these files**:
   - Move `scraper.py` and `requirements.txt` to a folder named `scripts/nepse-scraper/` in your new repo.
   - Move the `.github` folder to the root of your new repo.
3. **Enable Actions**: Go to your repo settings on GitHub, under **Actions > General**, ensure "Allow all actions and reusable workflows" is selected and "Read and write permissions" are enabled under "Workflow permissions".
4. **Result**: 
   - Every 30 minutes during Nepal market hours (Sun-Thu, 11 AM - 3 PM), GitHub will automatically run the script.
   - It will update `nepse_data.json` in your repository.
   - You can access this JSON file at: `https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO_NAME/main/nepse_data.json`

## Connecting to MyWallet:

Once your GitHub scraper is up and running, simply add your raw GitHub URL to the `APIS` array in:
`mywallet-app/app/api/nepse/today/route.ts`

```typescript
const APIS = [
    "YOUR_RAW_GITHUB_URL_HERE",
    "https://nepseapi.onrender.com/api/todays_price",
    // ...
]
```
