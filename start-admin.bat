@echo off
echo ========================================
echo    הפעלת פאנל ניהול Digitlex
echo ========================================
echo.

cd /d "%~dp0admin-panel"
echo 📂 מעבר לתיקיית פאנל ניהול...
echo.

echo 🚀 מפעיל את פאנל הניהול...
echo 📱 הפאנל יהיה זמין ב: http://localhost:3000
echo.

echo ⚠️  לחץ Ctrl+C כדי לעצור את הפאנל
echo.

npm run start:win

pause 