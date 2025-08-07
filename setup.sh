#!/bin/bash

echo "Setting up Book Barcode Scanner..."

# Python環境セットアップ
echo "Setting up Python backend environment..."
cd backend

# Python仮想環境作成
python3 -m venv venv

# 仮想環境の有効化とパッケージインストール
source venv/bin/activate
pip install --upgrade pip

# 必要なPythonパッケージをインストール
pip install fastapi uvicorn pydantic httpx beautifulsoup4 requests
pip install pytest pytest-asyncio black isort flake8

echo "Python backend environment setup complete."

# フロントエンド環境セットアップ
echo "Setting up JavaScript frontend environment..."
cd ../frontend

# package.jsonが存在する場合のみnpm install実行
if [ -f "package.json" ]; then
    npm install
    echo "JavaScript frontend dependencies installed."
else
    echo "package.json not found. Will be created in next step."
fi

# 開発ツールのインストール
echo "Installing development tools..."
cd ..

# pre-commitのインストール（グローバル）
pip install pre-commit

echo "Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Activate Python virtual environment: cd backend && source venv/bin/activate"
echo "2. Start FastAPI server: uvicorn main:app --reload"
echo "3. Open frontend/index.html in your browser"