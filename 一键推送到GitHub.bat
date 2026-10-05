@echo off
chcp 65001 >nul
title 推送卡密生成器 iOS 工程到 GitHub
cd /d "%~dp0"

echo.
echo   ============================================
echo     把 iOS 工程推送到 GitHub（自动编译出 IPA）
echo   ============================================
echo.
echo   请确认你已经：
echo     1) 安装并登录了 GitHub Desktop
echo     2) 你的 GitHub 用户名是：wnblm
echo.
echo   本脚本会做三件事：
echo     - 确认仓库位置与提交
echo     - 打开 GitHub Desktop，并自动定位到这个仓库
echo     - 提示你点「Publish repository」完成发布
echo.
pause

set REPO=%~dp0

echo.
echo [1/3] 检查仓库状态 ...
git -C "%REPO%" log --oneline -1 2>nul
if errorlevel 1 (
  echo   [错误] 这个文件夹不是 git 仓库，或者没有安装 Git。
  echo          请确认本脚本放在解压后的 kami-ios 文件夹里。
  pause
  exit /b 1
)

echo.
echo [2/3] 打开 GitHub Desktop ...
if exist "%LOCALAPPDATA%\GitHubDesktop\GitHubDesktop.exe" (
  start "" "%LOCALAPPDATA%\GitHubDesktop\GitHubDesktop.exe"
) else if exist "D:\GitHub\app-3.6.6\GitHubDesktop.exe" (
  start "" "D:\GitHub\app-3.6.6\GitHubDesktop.exe"
) else (
  echo   [提示] 没找到 GitHub Desktop，请手动打开它
)
timeout /t 5 >nul

echo.
echo [3/3] 接下来在 GitHub Desktop 里操作（3 步）：
echo.
echo     A. 菜单 File -^> Add local repository...
echo        路径填：%REPO%
echo        （如果它说这不是仓库，请确认上面这个路径里有 .github 文件夹）
echo.
echo    B. 右上角点 Publish repository
echo        Name 填：kami-ios
echo        取消勾选 Keep this code private   ^<-- 必须公开，Actions 才免费
echo.
echo    C. 点 Publish repository 按钮
echo.
echo    发布完成后，浏览器打开：
echo        https://github.com/wnblm/kami-ios/actions
echo    等 5~10 分钟变成绿色，进任务下载 Artifacts 里的 IPA
echo.
echo   本窗口可以关掉了。
echo.
pause
