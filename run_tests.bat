@echo off
REM Test runner script for Windows (Batch)
REM Usage: run_tests.bat

echo.
echo ============================================
echo   Running Feedback Analyzer Tests
echo ============================================
echo.

REM Backend Tests
echo.
echo [33mRunning Backend Tests...[0m
docker-compose exec -T backend pytest -v --cov=. --cov-report=term-missing
set BACKEND_EXIT=%ERRORLEVEL%

if %BACKEND_EXIT%==0 (
    echo [32m✓ Backend tests passed[0m
) else (
    echo [31m✗ Backend tests failed[0m
)

REM Frontend Tests
echo.
echo [33mRunning Frontend Tests...[0m
docker-compose exec -T frontend npm test
set FRONTEND_EXIT=%ERRORLEVEL%

if %FRONTEND_EXIT%==0 (
    echo [32m✓ Frontend tests passed[0m
) else (
    echo [31m✗ Frontend tests failed[0m
)

REM Summary
echo.
echo ============================================
echo   Test Summary
echo ============================================

if %BACKEND_EXIT%==0 (
    echo Backend:  [32mPASSED[0m
) else (
    echo Backend:  [31mFAILED[0m
)

if %FRONTEND_EXIT%==0 (
    echo Frontend: [32mPASSED[0m
) else (
    echo Frontend: [31mFAILED[0m
)

echo.

REM Exit with failure if any tests failed
if not %BACKEND_EXIT%==0 goto :failed
if not %FRONTEND_EXIT%==0 goto :failed

echo [32m✓ All tests passed![0m
exit /b 0

:failed
echo [31m✗ Some tests failed[0m
exit /b 1
