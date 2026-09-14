@echo off
setlocal enabledelayedexpansion

:: IronIQ Edge -- Windows Service installer
::
:: Double-click this file (or right-click -> Run as administrator) to
:: install the Edge agent as an auto-starting Windows Service, with no
:: need to open a command prompt or type anything yourself. Must sit in
:: the same folder as both the downloaded .exe and edge.config.json.
::
:: What this actually does, in order: (1) re-launches itself elevated if
:: it isn't already running as Administrator -- installing a Windows
:: Service requires that; (2) finds the real .exe in this folder,
:: whatever it's actually named (Windows appends "(1)", "(2)", etc. to
:: repeated downloads, so this doesn't assume an exact filename);
:: (3) confirms edge.config.json is actually present, since the install
:: needs a real config to point the service at; (4) runs the same
:: -install-service flag documented in the setup guide, then starts the
:: service. Every step is the same thing you'd type by hand -- this
:: just does it for you and handles the elevation prompt automatically.

:: Self-elevate if not already running as Administrator. `net session`
:: only succeeds when elevated -- a standard, well-established way to
:: check this from a plain .bat file, not a custom trick.
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo This needs Administrator access to install a Windows Service.
    echo Requesting it now -- click Yes on the prompt that appears...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"

echo.
echo Looking for the IronIQ Edge program in this folder...
:: Picks the MOST RECENTLY MODIFIED match specifically -- if repeated
:: downloads left several numbered copies behind (a real, likely
:: scenario if an earlier download was ever blocked and retried), this
:: picks the newest one rather than leaving it to whatever order the
:: filesystem happens to enumerate them in.
set EDGE_EXE=
for /f "delims=" %%f in ('dir /b /o:-d "ironiq-edge-windows-amd64*.exe" 2^>nul') do (
    if "!EDGE_EXE!"=="" set EDGE_EXE=%%f
)

if "%EDGE_EXE%"=="" (
    echo.
    echo Could not find ironiq-edge-windows-amd64.exe in this folder:
    echo   %~dp0
    echo Make sure this installer is saved in the same folder as the
    echo downloaded .exe, then try again.
    echo.
    pause
    exit /b 1
)
echo Found: %EDGE_EXE%

if not exist "edge.config.json" (
    echo.
    echo No edge.config.json found in this folder either. This program
    echo needs a real config file next to it before it can be installed
    echo as a service -- see the IronIQ Edge setup guide in the app
    echo ^(Administration, if you have access^) for what to put in it.
    echo.
    pause
    exit /b 1
)
echo Found: edge.config.json

echo.
echo Installing IronIQ Edge as a Windows Service...
"%EDGE_EXE%" --install-service --config edge.config.json
if %errorLevel% neq 0 (
    echo.
    echo Installation reported a problem -- see the message above for
    echo details. Nothing further will be attempted.
    echo.
    pause
    exit /b 1
)

echo.
echo Starting the service...
sc start IronIQEdge

echo.
echo Done. Open services.msc and look for "IronIQ Edge" to confirm it's
echo running -- it should also now start automatically every time this
echo PC boots, with nothing further needed from you.
echo.
pause
