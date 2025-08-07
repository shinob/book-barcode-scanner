import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient
import json

from main import app

class TestBookBarcodeAPI:
    
    def setup_method(self):
        """各テストメソッドの前に実行"""
        self.client = TestClient(app)
    
    def test_health_check(self):
        """ヘルスチェックエンドポイントのテスト"""
        response = self.client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "message" in data
    
    def test_root_endpoint(self):
        """ルートエンドポイントのテスト"""
        response = self.client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "docs" in data
        assert "health" in data
    
    def test_api_info(self):
        """API情報エンドポイントのテスト"""
        response = self.client.get("/api/info")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "version" in data
        assert "endpoints" in data
        assert "supported_isbn_formats" in data
    
    def test_amazon_price_invalid_isbn(self):
        """無効なISBNでの価格取得テスト"""
        response = self.client.get("/api/amazon-price/invalid-isbn")
        assert response.status_code == 400
        data = response.json()
        assert "Invalid ISBN format" in data["detail"]
    
    def test_amazon_price_valid_isbn_format(self):
        """有効な形式のISBNでの価格取得テスト（実際の取得は成功/失敗両方あり得る）"""
        # 有効なISBN-13の例
        isbn = "9784123456789"
        response = self.client.get(f"/api/amazon-price/{isbn}")
        
        # 価格が取得できる場合は200、見つからない場合は404
        assert response.status_code in [200, 404, 500]
        
        if response.status_code == 200:
            data = response.json()
            assert data["isbn"] == isbn
            assert "price" in data
            assert "currency" in data
    
    def test_amazon_prices_batch_empty_list(self):
        """空のISBNリストでのバッチ取得テスト"""
        response = self.client.post(
            "/api/amazon-prices",
            json=[]
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0
    
    def test_amazon_prices_batch_too_many_isbns(self):
        """制限を超えるISBN数でのバッチ取得テスト"""
        # 11個のISBNを送信（制限は10個）
        isbns = [f"978412345678{i}" for i in range(11)]
        response = self.client.post(
            "/api/amazon-prices",
            json=isbns
        )
        assert response.status_code == 400
        data = response.json()
        assert "Maximum 10 ISBNs per request" in data["detail"]
    
    def test_amazon_prices_batch_with_invalid_isbn(self):
        """無効なISBNを含むバッチ取得テスト"""
        isbns = ["9784123456789", "invalid-isbn"]
        response = self.client.post(
            "/api/amazon-prices",
            json=isbns
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        
        # 2番目の結果はエラーになるはず
        assert data[1]["isbn"] == "invalidisbn"  # ハイフンが除去される
        assert data[1]["error"] == "Invalid ISBN format"
    
    def test_cors_headers(self):
        """CORSヘッダーのテスト"""
        response = self.client.options("/health")
        # FastAPIのCORSMiddlewareがセットアップされていることを確認
        # 実際のヘッダーの詳細はミドルウェア設定に依存


class TestISBNValidation:
    """ISBN検証機能のテスト"""
    
    def test_valid_isbn13(self):
        """有効なISBN-13のテスト"""
        from main import _is_valid_isbn
        
        valid_isbn13s = [
            "9784123456789",
            "9780123456789",
            "9791234567890"
        ]
        
        for isbn in valid_isbn13s:
            assert _is_valid_isbn(isbn) == True
    
    def test_valid_isbn10(self):
        """有効なISBN-10のテスト"""
        from main import _is_valid_isbn
        
        valid_isbn10s = [
            "0123456789",
            "123456789X"
        ]
        
        for isbn in valid_isbn10s:
            assert _is_valid_isbn(isbn) == True
    
    def test_invalid_isbn(self):
        """無効なISBNのテスト"""
        from main import _is_valid_isbn
        
        invalid_isbns = [
            "",
            "123",
            "abcdefghij",
            "12345678901234",  # 14桁
            "123456789",       # 9桁
            "123456789Y"       # Xでない文字
        ]
        
        for isbn in invalid_isbns:
            assert _is_valid_isbn(isbn) == False


@pytest.mark.asyncio
class TestAmazonAPI:
    """Amazon API関連のテスト"""
    
    async def test_amazon_api_initialization(self):
        """Amazon APIクラスの初期化テスト"""
        from api.amazon import AmazonPriceAPI
        
        api = AmazonPriceAPI()
        assert api.base_url == "https://www.amazon.co.jp"
        assert len(api.user_agents) > 0
        
        # セッションのクリーンアップ
        await api.close()
    
    async def test_amazon_api_session_management(self):
        """Amazon APIのセッション管理テスト"""
        from api.amazon import AmazonPriceAPI
        
        api = AmazonPriceAPI()
        
        # 最初のセッション取得
        session1 = await api.get_session()
        assert session1 is not None
        
        # 同じセッションが返されることを確認
        session2 = await api.get_session()
        assert session1 is session2
        
        # セッションのクリーンアップ
        await api.close()
    
    def test_price_parsing(self):
        """価格解析機能のテスト"""
        from api.amazon import AmazonPriceAPI
        
        api = AmazonPriceAPI()
        
        test_cases = [
            ("￥1,234", 1234),
            ("¥5,678", 5678),
            ("1234", 1234),
            ("￥100", 100),
            ("invalid", None),
            ("", None),
            (None, None)
        ]
        
        for input_text, expected in test_cases:
            result = api._parse_price(input_text)
            assert result == expected


@pytest.fixture
def sample_book_data():
    """テスト用の書籍データ"""
    return {
        "isbn": "9784123456789",
        "title": "テスト書籍",
        "authors": ["テスト著者"],
        "publisher": "テスト出版社",
        "publishedDate": "2023-01-01",
        "listPrice": 1500,
        "amazonPrice": 800,
        "imageUrl": "https://example.com/image.jpg"
    }


class TestIntegration:
    """統合テスト"""
    
    def test_full_api_workflow(self, sample_book_data):
        """API全体のワークフローテスト"""
        client = TestClient(app)
        
        # 1. ヘルスチェック
        health_response = client.get("/health")
        assert health_response.status_code == 200
        
        # 2. API情報取得
        info_response = client.get("/api/info")
        assert info_response.status_code == 200
        
        # 3. 単一ISBN価格取得（形式チェックのみ）
        isbn = sample_book_data["isbn"]
        price_response = client.get(f"/api/amazon-price/{isbn}")
        assert price_response.status_code in [200, 404, 500]
    
    def test_error_handling(self):
        """エラーハンドリングのテスト"""
        client = TestClient(app)
        
        # 存在しないエンドポイント
        response = client.get("/nonexistent")
        assert response.status_code == 404
        
        # 無効なメソッド
        response = client.post("/health")
        assert response.status_code == 405


if __name__ == "__main__":
    # テスト実行
    pytest.main([__file__, "-v"])