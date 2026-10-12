@echo off
title AURA MOUSE - Virtual Mouse Server & Dashboard
color 0B

echo ======================================================================
echo          AURA MOUSE - HAND GESTURE VIRTUAL MOUSE CONTROLLER
echo ======================================================================
echo.

:: 1. Check & Compile Native Mouse Driver if needed
if not exist "%~dp0backend\native_driver\MouseDriver.exe" (
    echo [1/3] Compiling native Windows mouse driver...
    "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /target:exe /out:"%~dp0backend\native_driver\MouseDriver.exe" /optimize+ "%~dp0backend\native_driver\MouseDriver.cs"
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to compile MouseDriver.cs.
        pause
        exit /b %ERRORLEVEL%
    )
) else (
    echo [1/3] Native Windows mouse driver ready.
)

:: 2. Check Node modules
if not exist "%~dp0backend\node_modules" (
    echo [2/3] Installing backend Node.js packages...
    cd /d "%~dp0backend"
    call npm install
    cd /d "%~dp0"
) else (
    echo [2/3] Backend dependencies ready.
)

:: 3. Launch Backend Server & Open Browser
echo [3/3] Starting backend server on port 8080...
echo.
echo ======================================================================
echo  1. Dashboard URL:  http://localhost:8080
echo  2. Open MATLAB and run: matlab_cv\main_virtual_mouse.m
echo ======================================================================
echo.

start "" "http://localhost:8080"

cd /d "%~dp0backend"
node server.js

pause
