@echo off
setlocal
cd /d "%~dp0"
title EasyLib Manager

echo.
echo ========================================
echo        Iniciando EasyLib Manager
echo ========================================
echo.

set "ELECTRON_RUN_AS_NODE="

if not exist "node_modules\electron\dist\electron.exe" (
    echo Instalando dependencias pela primeira vez...
    call npm install
    if errorlevel 1 goto :erro
)

echo Preparando o banco de dados...
call npx prisma generate
if errorlevel 1 goto :erro
call npx prisma db push
if errorlevel 1 goto :erro

echo Compilando o sistema...
call npm run build
if errorlevel 1 goto :erro
call npm run transpile:electron
if errorlevel 1 goto :erro

echo Abrindo o EasyLib Manager...
call npm run dev:electron
exit /b 0

:erro
echo.
echo Nao foi possivel iniciar o sistema.
echo Verifique a mensagem acima ou abra a tela Debug.
echo.
pause
exit /b 1
