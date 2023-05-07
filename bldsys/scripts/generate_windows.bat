set SCRIPT_DIR=%~dp0

set ROOT_DIR=%SCRIPT_DIR%../..

cmake -G "Visual Studio 16 2019" -A x64 -S %ROOT_DIR% -B %ROOT_DIR%/build/windows

pause