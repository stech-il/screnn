@echo off
echo ========================================
echo הכנת הפרויקט להעלאה ל-GitHub
echo ========================================

echo.
echo 1. יצירת .gitignore...
if not exist .gitignore (
    echo node_modules/ > .gitignore
    echo .env >> .gitignore
    echo *.log >> .gitignore
    echo .DS_Store >> .gitignore
    echo Thumbs.db >> .gitignore
    echo dist/ >> .gitignore
    echo build/ >> .gitignore
    echo .next/ >> .gitignore
    echo .cache/ >> .gitignore
    echo npm-debug.log* >> .gitignore
    echo yarn-debug.log* >> .gitignore
    echo yarn-error.log* >> .gitignore
    echo .env.local >> .gitignore
    echo .env.development.local >> .gitignore
    echo .env.test.local >> .gitignore
    echo .env.production.local >> .gitignore
    echo .gitignore נוצר בהצלחה
) else (
    echo .gitignore כבר קיים
)

echo.
echo 2. אתחול Git repository...
git init

echo.
echo 3. הוספת כל הקבצים...
git add .

echo.
echo 4. יצירת commit ראשון...
git commit -m "Initial commit - Digitlex Digital Screen System"

echo.
echo ========================================
echo הפרויקט מוכן להעלאה!
echo ========================================
echo.
echo עכשיו עליך:
echo 1. ליצור repository ב-GitHub
echo 2. להריץ את הפקודות הבאות:
echo.
echo git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
echo git branch -M main
echo git push -u origin main
echo.
echo החלף YOUR_USERNAME ו-YOUR_REPO_NAME עם הפרטים שלך
echo.
pause 