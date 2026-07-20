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

if %errorlevel% neq 0 (
    color 0E
    echo.
    echo ---------------------------------------------------
    echo [WARNING] The push command returned an error.
    echo This is usually due to missing credentials or authentication.
    echo.
    echo Please make sure you are logged in to Git or have ssh keys setup.
    echo You can authenticate by running: 'gh auth login' or entering credentials.
    echo Once authenticated, run: 'git push -u origin main' manually.
    echo ---------------------------------------------------
) else (
    color 0A
    echo.
    echo [SUCCESS] Project successfully pushed to GitHub!
    echo Check it here: https://github.com/YashwanthNavari/DeveloperZip-Intelligent-Project-Packaging-for-Software-Developers
)

echo.
pause
