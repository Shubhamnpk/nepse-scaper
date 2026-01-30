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

## Viewing the Dashboard:

This repository includes a modern, responsive web dashboard to visualize the NEPSE data.

1.  **Enable GitHub Pages**:
    - Go to your repo settings on GitHub.
    - Click on **Pages** in the left sidebar.
    - Under **Build and deployment > Source**, select "Deploy from a branch".
    - Select `main` branch and `/ (root)` folder.
    - Click **Save**.
2.  **Access your Dashboard**:
    - Wait a minute for the deployment to finish.


## Connecting to MyWallet:
