@echo off
echo ========================================
echo    הפעלת אפליקציית לקוח Digitlex
echo ========================================
echo.

cd /d "%~dp0client-app"
echo 📂 מעבר לתיקיית אפליקציית לקוח...
echo.

echo 🚀 מפעיל את אפליקציית הלקוח...
echo 🖥️  האפליקציה תהיה זמינה ב: http://localhost:3002/client
echo.

echo ⚠️  לחץ Ctrl+C כדי לעצור את האפליקציה
echo.

npm run start:win

pause 