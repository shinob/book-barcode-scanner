# 本のバーコードスキャナー

本のバーコード（ISBN）をスキャンして、書籍情報と中古価格を取得・管理できるWebアプリケーション

## 📱 主要機能

### バーコードスキャン
- デバイスのカメラを使用してISBNバーコードをスキャン
- ISBN-10、ISBN-13に対応
- 手動ISBN入力にも対応

### 書籍情報取得
- Google Books APIから書籍情報を自動取得
- タイトル、著者名、定価、出版社、出版日を表示
- 書籍画像のサムネイル表示

### Amazon中古価格取得
- バックエンドAPI経由でAmazon上の中古価格を取得
- 定価との価格差を自動計算
- 利益の出る書籍をハイライト表示

### データ管理・エクスポート
- スキャンした書籍をリスト表示・管理
- Excel (.xlsx) / CSV (.csv) 形式でデータエクスポート
- ローカルストレージによるデータ永続化

## 🚀 技術スタック

### フロントエンド
- **Vanilla JavaScript** + ES6 Modules
- **ZXing-js** - バーコードスキャン
- **SheetJS** - Excelエクスポート
- **レスポンシブデザイン** - モバイル対応

### バックエンド
- **Python 3** + **FastAPI**
- **httpx** - 非同期HTTP通信
- **BeautifulSoup4** - Webスクレイピング
- **Pydantic** - データバリデーション

### 開発・テスト
- **Jest** - フロントエンドテスト
- **pytest** - バックエンドテスト
- **Makefile** - タスク自動化
- **ESLint + Prettier** - コード品質管理

## 📦 インストール

### 前提条件
- Python 3.8+
- Node.js 14+
- npm

### セットアップ

1. **リポジトリのクローン**
   ```bash
   git clone https://github.com/your-username/book-barcode-scanner.git
   cd book-barcode-scanner
   ```

2. **自動セットアップ実行**
   ```bash
   ./setup.sh
   # または
   make setup
   ```

3. **環境変数の設定**
   ```bash
   cp .env.example .env
   # .envファイルを編集してAPIキーを設定
   ```

## 🎮 使用方法

### 開発サーバー起動

1. **バックエンドサーバー起動**
   ```bash
   make start-backend
   # または
   cd backend && source venv/bin/activate && python main.py
   ```

2. **フロントエンドサーバー起動** (別ターミナル)
   ```bash
   make start-frontend
   # または
   cd frontend && npm run start
   ```

3. **アプリケーションアクセス**
   - フロントエンド: http://127.0.0.1:3000
   - バックエンドAPI: http://127.0.0.1:3001
   - API仕様書: http://127.0.0.1:3001/docs

### アプリケーション使用手順

1. **「スキャン開始」ボタンをクリック**してカメラを起動
2. **ISBNバーコードをカメラに向ける**
3. **書籍情報が自動取得・表示**される
4. **「エクスポート」ボタン**でExcel/CSVファイルをダウンロード

## 🧪 テスト実行

```bash
# 全テスト実行
make test

# フロントエンドテストのみ
make test-frontend

# バックエンドテストのみ
make test-backend

# テストカバレッジ生成
make test-coverage
```

## 🔧 開発コマンド

```bash
# 利用可能なコマンド一覧
make help

# コード品質チェック
make lint

# コードフォーマット
make format

# 一時ファイル削除
make clean

# 依存関係更新
make update-deps

# セキュリティチェック
make security-check
```

## 📁 プロジェクト構成

```
book-barcode-scanner/
├── frontend/                 # フロントエンド
│   ├── index.html
│   ├── css/style.css
│   ├── js/
│   │   ├── app.js           # メインアプリケーション
│   │   ├── scanner.js       # バーコードスキャン機能
│   │   ├── bookApi.js       # API通信
│   │   └── export.js        # エクスポート機能
│   ├── tests/unit/          # ユニットテスト
│   └── package.json
├── backend/                  # バックエンド
│   ├── main.py              # FastAPIメインアプリ
│   ├── api/amazon.py        # Amazon価格取得
│   ├── tests/test_api.py    # APIテスト
│   └── requirements.txt
├── .env.example             # 環境変数テンプレート
├── setup.sh                 # セットアップスクリプト
├── Makefile                 # タスク自動化
├── 要件書.md                # プロジェクト要件
└── 開発計画.md              # 開発計画書
```

## ⚙️ 設定

### 環境変数 (.env)

```bash
# Amazon価格取得API設定
AMAZON_ACCESS_KEY_ID=your_amazon_access_key_here
AMAZON_SECRET_ACCESS_KEY=your_amazon_secret_key_here
AMAZON_ASSOCIATE_TAG=your_associate_tag_here

# FastAPI設定
FASTAPI_HOST=127.0.0.1
FASTAPI_PORT=3001
FASTAPI_DEBUG=True

# Google Books API設定（オプション）
GOOGLE_BOOKS_API_KEY=your_google_books_api_key_here

# ログレベル
LOG_LEVEL=INFO

# CORS設定
ALLOWED_ORIGINS=http://127.0.0.1:3000,http://localhost:3000
```

## 🔒 セキュリティ要件

- **HTTPS必須** - カメラアクセスのため
- **CORS設定** - セキュアな通信
- **個人情報の非保存** - セッションベースのデータ管理
- **APIキー環境変数管理** - シークレット情報の保護

## 📈 成功基準

- ✅ バーコードスキャン精度 95%以上
- ✅ 書籍情報取得成功率 90%以上
- ✅ レスポンス時間 3秒以内
- ✅ モバイル対応完全サポート

## ⚠️ 注意事項

1. **Amazon価格取得について**
   - Webスクレイピングを使用しているため、Amazon利用規約に従って使用してください
   - 過度なリクエストは避け、適切なレート制限を実装してください
   - 本番環境ではAmazon Product Advertising APIの使用を推奨します

2. **カメラアクセス**
   - HTTPSでの運用が必要です
   - ブラウザでカメラアクセス権限の許可が必要です

3. **環境の互換性**
   - Makefileはbash/sh互換で設計されています
   - `source`コマンドの問題を回避するため、`bash -c`を使用しています
   - 異なるシェル環境でも正常に動作します

## 🔧 トラブルシューティング

### よくある問題と解決方法

#### 1. `source: not found` エラー
```bash
# エラー例
/bin/sh: 1: source: not found
make: *** [Makefile:54: start-backend] エラー 127
```

**原因**: `/bin/sh`環境で`source`コマンドが利用できない

**解決策**: 最新版のMakefileを使用してください（`bash -c`で修正済み）

#### 2. カメラアクセスエラー
```
カメラの起動に失敗しました: NotAllowedError
```

**解決策**: 
- ブラウザでカメラアクセス許可を有効にする
- HTTPSでアクセスする（`http://`ではなく`https://`）

#### 3. Amazon価格取得エラー
```
Amazon price fetch failed: 404
```

**解決策**: 
- 書籍がAmazonで販売されていない可能性があります
- しばらく待ってから再試行してください（レート制限）

#### 4. ポート番号の競合
```
Address already in use: 3001
```

**解決策**: 
- 他のプロセスがポートを使用している場合があります
- `.env`ファイルでポート番号を変更してください

#### 5. モジュールインポートエラー
```
ModuleNotFoundError: No module named 'dotenv'
```

**解決策**: 
- 仮想環境内で依存関係をインストールしてください：
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```
- または`make install-backend`を実行してください

## 🤝 貢献

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 ライセンス

このプロジェクトはMITライセンスのもとで公開されています。詳細は [LICENSE](LICENSE) ファイルをご覧ください。

## 📞 サポート

問題が発生した場合は、[Issues](https://github.com/your-username/book-barcode-scanner/issues)ページで報告してください。

---

**🤖 このプロジェクトは [Claude Code](https://claude.ai/code) を使用して開発されました**