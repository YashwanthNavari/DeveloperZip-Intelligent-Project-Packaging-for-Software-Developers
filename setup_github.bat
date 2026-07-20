@echo off
title DeveloperZip GitHub Sync Setup
color 0B
echo =======================================================
echo     DeveloperZip - GitHub Push ^& Setup Helper
echo =======================================================
echo.

:: Check for Git installation
where git >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Git is not installed or not in your system PATH!
    echo Please install Git from https://git-scm.com/ and try again.
    echo.
    pause
    exit /b 1
)

echo [1/5] Checking Git repository initialization...
if not exist .git (
    echo - Initializing a new Git repository...
    git init
) else (
    echo - Git repository already initialized.
)
echo.

echo [2/5] Setting up Remote Origin URL...
:: Remove origin if it exists to avoid conflicts, then add the user's repository
git remote remove origin >nul 2>nul
git remote add origin https://github.com/YashwanthNavari/DeveloperZip-Intelligent-Project-Packaging-for-Software-Developers.git
echo - Configured remote to:
git remote -v
echo.

echo [3/5] Staging files for commit...
echo - This might take a few seconds (ignoring files configured in .gitignore)...
git add .
echo.

echo [4/5] Creating initial commit...
git commit -m "feat: initial commit with premium README & daily auto-commit workflow"
echo.

echo [5/5] Preparing to push changes to GitHub...
git branch -M main
echo.
echo =======================================================
echo READY TO PUSH!
echo =======================================================
echo If you have configured your GitHub credentials/token, press any key to push.
echo Otherwise, close this window, configure git credentials, and run:
echo 'git push -u origin main'
echo =======================================================
pause
echo.
echo - Pushing main branch to origin...
git push -u origin main

if %errorlevel% neq 0 goto :failed_push

color 0A
echo.
echo [SUCCESS] Project successfully pushed to GitHub!
echo Check it here: https://github.com/YashwanthNavari/DeveloperZip-Intelligent-Project-Packaging-for-Software-Developers
goto :end

:failed_push
color 0E
echo.
echo ---------------------------------------------------
echo [ALERT] Push failed or was rejected.
echo.
echo This usually happens if:
echo 1. The remote repository already has files (e.g. README/License).
echo 2. You are not authenticated with GitHub.
echo.
echo How would you like to proceed?
echo [1] Force Push (Overwrite everything on GitHub with this local project)
echo     - RECOMMENDED if this is a newly created repo.
echo [2] Pull and Merge (Download remote changes and merge them)
echo [3] Cancel / Exit
echo ---------------------------------------------------
set /p choice="Enter your choice (1, 2, or 3): "

if "%choice%"=="1" goto :force_push
if "%choice%"=="2" goto :pull_merge
goto :end

:force_push
echo.
echo - Force pushing to origin main...
git push -u origin main --force
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Force push failed. Make sure you are authenticated with GitHub.
) else (
    color 0A
    echo.
    echo [SUCCESS] Force push completed successfully!
    echo Check it here: https://github.com/YashwanthNavari/DeveloperZip-Intelligent-Project-Packaging-for-Software-Developers
)
goto :end

:pull_merge
echo.
echo - Pulling remote changes with unrelated histories allowed...
git pull origin main --allow-unrelated-histories --no-edit
echo - Retrying push...
git push -u origin main
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Push failed after pulling changes.
) else (
    color 0A
    echo.
    echo [SUCCESS] Project successfully pushed to GitHub!
    echo Check it here: https://github.com/YashwanthNavari/DeveloperZip-Intelligent-Project-Packaging-for-Software-Developers
)
goto :end

:end
echo.
pause

