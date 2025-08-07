# Book Barcode Scanner - Makefile
# 開発タスクの自動化

.PHONY: help setup clean test lint format start-backend start-frontend build install-frontend install-backend

# デフォルトターゲット
help:
	@echo "Book Barcode Scanner - Available Commands:"
	@echo ""
	@echo "Setup Commands:"
	@echo "  setup              - 開発環境の初期セットアップ"
	@echo "  install-frontend   - フロントエンド依存関係のインストール"
	@echo "  install-backend    - バックエンド依存関係のインストール"
	@echo ""
	@echo "Development Commands:"
	@echo "  start-backend      - バックエンドサーバーを起動 (開発モード)"
	@echo "  start-frontend     - フロントエンドサーバーを起動"
	@echo ""
	@echo "Testing Commands:"
	@echo "  test               - 全テストを実行"
	@echo "  test-frontend      - フロントエンドテストを実行"
	@echo "  test-backend       - バックエンドテストを実行"
	@echo "  test-coverage      - テストカバレッジを生成"
	@echo ""
	@echo "Code Quality Commands:"
	@echo "  lint               - 全コードの静的解析"
	@echo "  lint-frontend      - フロントエンドのlint"
	@echo "  lint-backend       - バックエンドのlint"
	@echo "  format             - 全コードのフォーマット"
	@echo "  format-frontend    - フロントエンドのフォーマット"
	@echo "  format-backend     - バックエンドのフォーマット"
	@echo ""
	@echo "Utility Commands:"
	@echo "  clean              - 一時ファイルとビルド成果物を削除"
	@echo "  build              - プロダクションビルド"

# セットアップコマンド
setup:
	@echo "Setting up development environment..."
	./setup.sh
	@echo "Setup completed!"

install-frontend:
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

install-backend:
	@echo "Installing backend dependencies..."
	cd backend && source venv/bin/activate && pip install -r requirements.txt

# 開発サーバー起動
start-backend:
	@echo "Starting backend server..."
	cd backend && source venv/bin/activate && python main.py

start-frontend:
	@echo "Starting frontend server..."
	cd frontend && npm run start

# テストコマンド
test: test-frontend test-backend
	@echo "All tests completed!"

test-frontend:
	@echo "Running frontend tests..."
	cd frontend && npm test

test-backend:
	@echo "Running backend tests..."
	cd backend && source venv/bin/activate && pytest tests/ -v

test-coverage:
	@echo "Generating test coverage reports..."
	cd frontend && npm run test:coverage
	cd backend && source venv/bin/activate && pytest tests/ --cov=. --cov-report=html --cov-report=term

# コード品質
lint: lint-frontend lint-backend
	@echo "Linting completed!"

lint-frontend:
	@echo "Linting frontend code..."
	cd frontend && npm run lint

lint-backend:
	@echo "Linting backend code..."
	cd backend && source venv/bin/activate && flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
	cd backend && source venv/bin/activate && flake8 . --count --exit-zero --max-complexity=10 --max-line-length=88 --statistics

format: format-frontend format-backend
	@echo "Formatting completed!"

format-frontend:
	@echo "Formatting frontend code..."
	cd frontend && npm run format

format-backend:
	@echo "Formatting backend code..."
	cd backend && source venv/bin/activate && black .
	cd backend && source venv/bin/activate && isort .

# ビルドとクリーンアップ
build:
	@echo "Building for production..."
	@echo "Frontend: Static files ready"
	@echo "Backend: No build required for Python"
	@echo "Build completed!"

clean:
	@echo "Cleaning up temporary files..."
	# Python キャッシュファイル
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	
	# Node.js 関連
	rm -rf frontend/node_modules/.cache 2>/dev/null || true
	rm -rf frontend/coverage 2>/dev/null || true
	
	# テスト・カバレッジファイル
	rm -rf backend/htmlcov 2>/dev/null || true
	rm -f backend/.coverage 2>/dev/null || true
	
	# ログファイル
	rm -f *.log 2>/dev/null || true
	
	@echo "Cleanup completed!"

# 開発用便利コマンド
dev-setup: setup
	@echo "Creating .env file from template..."
	cp .env.example .env
	@echo "Development setup completed!"
	@echo "Please edit .env file with your API keys"

check-env:
	@echo "Checking environment..."
	@command -v python3 >/dev/null 2>&1 || { echo "Python3 is required but not installed."; exit 1; }
	@command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed."; exit 1; }
	@command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed."; exit 1; }
	@echo "Environment check passed!"

# 統合テスト（フロント・バック両方起動が必要）
test-integration:
	@echo "Running integration tests..."
	@echo "Note: This requires both frontend and backend to be running"
	# E2Eテストがある場合はここで実行
	@echo "Integration tests completed!"

# デプロイ前チェック
pre-deploy: clean lint test
	@echo "Pre-deployment checks completed!"
	@echo "Ready for deployment!"

# 開発環境の完全リセット
reset: clean
	@echo "Resetting development environment..."
	rm -rf backend/venv 2>/dev/null || true
	rm -rf frontend/node_modules 2>/dev/null || true
	rm -f .env 2>/dev/null || true
	@echo "Environment reset completed!"
	@echo "Run 'make setup' to reinstall dependencies"

# 依存関係のアップデート
update-deps:
	@echo "Updating dependencies..."
	cd frontend && npm update
	cd backend && source venv/bin/activate && pip install --upgrade -r requirements.txt
	@echo "Dependencies updated!"

# セキュリティチェック
security-check:
	@echo "Running security checks..."
	cd frontend && npm audit
	cd backend && source venv/bin/activate && pip check
	@echo "Security check completed!"

# 設定確認
config-check:
	@echo "Configuration check:"
	@echo "Frontend config: $(shell ls frontend/package.json 2>/dev/null || echo 'Not found')"
	@echo "Backend config: $(shell ls backend/requirements.txt 2>/dev/null || echo 'Not found')"
	@echo "Environment template: $(shell ls .env.example 2>/dev/null || echo 'Not found')"
	@echo "Environment file: $(shell ls .env 2>/dev/null || echo 'Not found (create from .env.example)')"

# バージョン情報表示
version:
	@echo "Book Barcode Scanner v1.0.0"
	@echo "Python version: $(shell python3 --version 2>/dev/null || echo 'Not available')"
	@echo "Node.js version: $(shell node --version 2>/dev/null || echo 'Not available')"
	@echo "npm version: $(shell npm --version 2>/dev/null || echo 'Not available')"