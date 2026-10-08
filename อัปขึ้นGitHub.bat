@echo off
chcp 65001 >nul
cd /d "%~dp0"
git add -A
git commit -m "Update trainee database: add 2569 (7 courses) and fix ID/birth date errors"
git push
echo.
echo ===== เสร็จแล้ว กดปุ่มใดก็ได้เพื่อปิด =====
pause >nul
