@echo off
echo ========================================
echo    הפעלת Desktop Client - Digitlex
echo ========================================
echo.

cd /d "%~dp0"
echo 📂 מעבר לתיקיית ה-desktop client...
echo.

echo 🔧 בודק אם Node.js זמין...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js לא מותקן. אנא התקן Node.js ונסה שוב.
    pause
    exit /b 1
)
echo ✅ Node.js זמין

echo.
echo 📦 בודק dependencies...
if not exist "node_modules" (
    echo 📦 מתקין dependencies...
    npm install
    if errorlevel 1 (
        echo ❌ שגיאה בהתקנת dependencies
        pause
        exit /b 1
    )
) else (
    echo ✅ Dependencies מותקנים
)

echo.
echo 🚀 מפעיל את ה-Desktop Client...
echo.
echo 💡 טיפים:
echo    - לחץ F8 לתפריט ניהול
echo    - לחץ ESC ליציאה
echo    - ודא שהשרת רץ על http://localhost:3001
echo.

npm start

echo.
echo ❌ ה-Desktop Client נסגר
pause
