#!/bin/bash

# =====================================================
# SuperTab Chrome Extension 安装脚本 (macOS/Linux)
# =====================================================

echo ""
echo "🚀 SuperTab Chrome Extension 安装助手"
echo "==================================="
echo ""

# 检查文件是否存在
if [ ! -f "SuperTab-Chrome-Extension-v1.0.0.zip" ]; then
    echo "❌ 错误: 未找到 SuperTab-Chrome-Extension-v1.0.0.zip 文件"
    echo "请确保安装包与本脚本在同一目录下"
    exit 1
fi

echo "✅ 找到安装包文件"

echo ""
echo "📦 正在解压扩展文件..."

# 创建扩展文件夹
if [ ! -d "supertab-extension" ]; then
    mkdir supertab-extension
fi

# 解压文件
unzip -q SuperTab-Chrome-Extension-v1.0.0.zip -d supertab-extension

if [ $? -eq 0 ]; then
    echo "✅ 解压完成！"
else
    echo "❌ 解压失败，请手动解压文件"
    exit 1
fi

echo ""
echo "🔧 安装说明:"
echo "==================================="
echo "1. 打开Chrome浏览器"
echo "2. 访问 chrome://extensions/"
echo "3. 开启右上角的\"开发者模式\""
echo "4. 点击\"加载已解压的扩展程序\""
echo "5. 选择当前目录下的 \"supertab-extension\" 文件夹"

echo ""
echo "🎉 安装包已准备就绪！"
echo "请按照上述步骤在Chrome中加载扩展。"

echo ""
echo "📁 解压文件位置: $(pwd)/supertab-extension"

echo ""

# 尝试在macOS上打开Chrome扩展页面
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "💡 正在尝试打开Chrome扩展页面..."
    open "chrome://extensions/"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "💡 正在尝试打开Chrome扩展页面..."
    xdg-open "chrome://extensions/" || google-chrome "chrome://extensions/" || chromium-browser "chrome://extensions/" || echo "请手动打开 chrome://extensions/"
fi

echo ""
echo "提示: 如果Chrome页面没有自动打开，请手动访问 chrome://extensions/"

# 设置脚本权限提醒
echo ""
echo "💡 下次使用时，可以直接运行: ./install.sh"