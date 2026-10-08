@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ===== ล้างประวัติ Git แล้วอัปขึ้น GitHub ใหม่ =====
echo ใช้หลังจาก ลบ repo เดิม และสร้าง repo ใหม่ชื่อ performance-summary (แบบว่าง) บน GitHub แล้วเท่านั้น
echo.
echo [1/3] ตรวจว่า database.html เป็นฉบับเข้ารหัส...
findstr /m "ENC_PAYLOAD" database.html >nul
if errorlevel 1 (
  echo [หยุด] database.html ยังไม่ใช่ฉบับเข้ารหัส - ห้ามอัปขึ้น
  pause
  exit /b 1
)
echo [2/3] ตรวจว่าไม่มีเลข 13 หลักในไฟล์ที่จะอัป...
powershell -NoProfile -Command "$bad = Get-ChildItem -Recurse -File -Force | Where-Object { $_.FullName -notmatch '\\\.git\\' -and $_.Extension -match '^\.(html|htm|md|js|json|txt|csv)$' } | Select-String -Pattern '(?<!\d)\d{13}(?!\d)' -List; if ($bad) { $bad | ForEach-Object { $_.Path }; exit 1 }"
if errorlevel 1 (
  echo [หยุด] พบเลข 13 หลักในไฟล์ด้านบน - ห้ามอัปขึ้น
  pause
  exit /b 1
)
echo ผ่านการตรวจทั้งสองข้อ
echo.
set /p OK=[3/3] พิมพ์ YES แล้วกด Enter เพื่ออัปขึ้น GitHub แบบไม่มีประวัติเก่า: 
if /i not "%OK%"=="YES" (
  echo ยกเลิกแล้ว ไม่มีการเปลี่ยนแปลง
  pause
  exit /b 0
)
git checkout --orphan clean-main || goto fail
git add -A || goto fail
git commit -m "Clean publish: trainee database encrypted, history removed" || goto fail
git branch -D main
git branch -m main || goto fail
git push -f -u origin main || goto fail
echo.
echo ===== เสร็จแล้ว: อัปขึ้น GitHub แบบไม่มีประวัติเก่าเรียบร้อย =====
echo ขั้นต่อไป: เปิด Settings ^> Pages ของ repo แล้วเลือก Deploy from a branch: main / (root)
pause >nul
exit /b 0
:fail
echo.
echo [ผิดพลาด] คำสั่ง git ไม่สำเร็จ - กรุณาแคปหน้าจอนี้ส่งให้ Claude
pause
exit /b 1
