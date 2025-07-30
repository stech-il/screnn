@echo off
echo ========================================
echo    הפעלת שרת Digitlex
echo ========================================
echo.

cd /d "%~dp0server"
echo 📂 מעבר לתיקיית השרת...
echo.

echo 🚀 מפעיל את השרת...
echo 📡 השרת יהיה זמין ב: http://localhost:3001
echo 📱 פאנל ניהול: http://localhost:3001/admin
echo 🖥️  מסך לקוח: http://localhost:3001/client
echo.

echo ⚠️  לחץ Ctrl+C כדי לעצור את השרת
echo.

node index.js

pause 