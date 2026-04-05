#!/bin/sh
set -e
CURRENT_DATE=$(date +"%Y-%m-%d %H:%M:%S")

git pull origin main
echo "✅ Pulled latest changes from main branch."
git add .; git commit -m "$CURRENT_DATE"; git push origin main