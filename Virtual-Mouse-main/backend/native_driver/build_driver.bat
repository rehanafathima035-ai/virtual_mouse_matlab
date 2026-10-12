@echo off
echo Compiling MouseDriver.cs with .NET Framework C# compiler...
"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /target:exe /out:"%~dp0MouseDriver.exe" /optimize+ "%~dp0MouseDriver.cs"
if %ERRORLEVEL% EQU 0 (
    echo MouseDriver.exe compiled successfully!
) else (
    echo Compilation failed with code %ERRORLEVEL%
)
