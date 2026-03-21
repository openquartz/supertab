@echo off

:: =====================================================
:: SuperTab Chrome Extension 安装脚本 (Windows)
:: =====================================================

echo.
echo 🚀 SuperTab Chrome Extension 安装助手
echo ===================================
echo.

:: 检查文件是否存在
if not exist "SuperTab-Chrome-Extension-v1.0.0.zip" (
    echo ❌ 错误: 未找到 SuperTab-Chrome-Extension-v1.0.0.zip 文件
    echo 请确保安装包与本脚本在同一目录下
    pause
    exit /b 1
)

echo ✅ 找到安装包文件

echo.
echo 📦 正在解压扩展文件...
:: 创建扩展文件夹
if not exist "supertab-extension" mkdir supertab-extension

:: 使用PowerShell解压
powershell -Command "Expand-Archive -Path 'SuperTab-Chrome-Extension-v1.0.0.zip' -DestinationPath 'supertab-extension' -Force"

if %errorlevel% equ 0 (
    echo ✅ 解压完成！
) else (
    echo ❌ 解压失败，请手动解压文件
    pause
    exit /b 1
)

echo.
echo 🔧 安装说明:
echo ===================================
echo 1. 打开Chrome浏览器
echo 2. 访问 chrome://extensions/
 echo 3. 开启右上角的"开发者模式"
echo 4. 点击"加载已解压的扩展程序"
echo 5. 选择当前目录下的 "supertab-extension" 文件夹

echo.
echo 🎉 安装包已准备就绪！
echo 请按照上述步骤在Chrome中加载扩展。

echo.
echo 📁 解压文件位置: %CD%\supertab-extension

echo.
start chrome chrome://extensions/

echo 💡 提示: Chrome扩展页面已自动打开

pause