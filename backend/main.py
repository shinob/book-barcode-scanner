from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
from dotenv import load_dotenv
import logging
from contextlib import asynccontextmanager

from api.amazon import AmazonPriceAPI

# 環境変数を読み込み
load_dotenv()

# ログ設定
logging.basicConfig(
    level=getattr(logging, os.getenv('LOG_LEVEL', 'INFO')),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# アプリケーション起動時の処理
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Book Barcode Scanner API...")
    yield
    logger.info("Shutting down Book Barcode Scanner API...")

# FastAPIアプリケーションの初期化
app = FastAPI(
    title="Book Barcode Scanner API",
    description="本のバーコードスキャナー用バックエンドAPI - Amazon価格取得機能を提供",
    version="1.0.0",
    lifespan=lifespan
)

# CORS設定
allowed_origins = os.getenv('ALLOWED_ORIGINS', 'http://127.0.0.1:3000,http://localhost:3000').split(',')

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Amazon価格取得APIのインスタンス
amazon_api = AmazonPriceAPI()

# レスポンスモデル
class AmazonPriceResponse(BaseModel):
    isbn: str
    price: Optional[int] = None
    currency: str = "JPY"
    availability: Optional[str] = None
    error: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    message: str

class ErrorResponse(BaseModel):
    error: str
    message: str

# ヘルスチェックエンドポイント
@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="ok",
        message="Book Barcode Scanner API is running"
    )

# Amazon価格取得エンドポイント
@app.get("/api/amazon-price/{isbn}", response_model=AmazonPriceResponse)
async def get_amazon_price(isbn: str):
    """
    指定されたISBNのAmazon中古価格を取得
    
    Args:
        isbn: ISBN-10 または ISBN-13
        
    Returns:
        Amazon価格情報
        
    Raises:
        HTTPException: ISBNが無効、または価格取得に失敗した場合
    """
    try:
        # ISBNの基本的な検証
        cleaned_isbn = isbn.replace('-', '').replace(' ', '')
        if not _is_valid_isbn(cleaned_isbn):
            raise HTTPException(
                status_code=400,
                detail="Invalid ISBN format"
            )
        
        logger.info(f"Fetching Amazon price for ISBN: {cleaned_isbn}")
        
        # Amazon価格を取得
        price_info = await amazon_api.get_price(cleaned_isbn)
        
        if price_info is None:
            raise HTTPException(
                status_code=404,
                detail="Price information not found"
            )
        
        return AmazonPriceResponse(
            isbn=cleaned_isbn,
            price=price_info.get('price'),
            currency=price_info.get('currency', 'JPY'),
            availability=price_info.get('availability'),
            error=None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching Amazon price for {isbn}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

# 複数ISBN価格取得エンドポイント
@app.post("/api/amazon-prices", response_model=List[AmazonPriceResponse])
async def get_amazon_prices_batch(isbns: List[str]):
    """
    複数ISBNのAmazon価格を一括取得
    
    Args:
        isbns: ISBN一覧
        
    Returns:
        Amazon価格情報一覧
    """
    if len(isbns) > 10:
        raise HTTPException(
            status_code=400,
            detail="Maximum 10 ISBNs per request"
        )
    
    results = []
    
    for isbn in isbns:
        try:
            cleaned_isbn = isbn.replace('-', '').replace(' ', '')
            
            if not _is_valid_isbn(cleaned_isbn):
                results.append(AmazonPriceResponse(
                    isbn=cleaned_isbn,
                    error="Invalid ISBN format"
                ))
                continue
            
            price_info = await amazon_api.get_price(cleaned_isbn)
            
            if price_info is None:
                results.append(AmazonPriceResponse(
                    isbn=cleaned_isbn,
                    error="Price information not found"
                ))
            else:
                results.append(AmazonPriceResponse(
                    isbn=cleaned_isbn,
                    price=price_info.get('price'),
                    currency=price_info.get('currency', 'JPY'),
                    availability=price_info.get('availability')
                ))
        
        except Exception as e:
            logger.error(f"Error fetching price for {isbn}: {str(e)}")
            results.append(AmazonPriceResponse(
                isbn=cleaned_isbn,
                error=str(e)
            ))
    
    return results

# API情報エンドポイント
@app.get("/api/info")
async def get_api_info():
    """API情報を取得"""
    return {
        "name": "Book Barcode Scanner API",
        "version": "1.0.0",
        "description": "本のバーコードスキャナー用バックエンドAPI",
        "endpoints": {
            "health": "/health",
            "amazon_price": "/api/amazon-price/{isbn}",
            "amazon_prices_batch": "/api/amazon-prices",
            "api_info": "/api/info"
        },
        "supported_isbn_formats": ["ISBN-10", "ISBN-13"],
        "max_batch_size": 10
    }

# エラーハンドラー
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return ErrorResponse(
        error="Not Found",
        message="The requested resource was not found"
    )

@app.exception_handler(500)
async def internal_server_error_handler(request, exc):
    return ErrorResponse(
        error="Internal Server Error",
        message="An internal server error occurred"
    )

# ユーティリティ関数
def _is_valid_isbn(isbn: str) -> bool:
    """ISBNの基本的な形式チェック"""
    if not isbn:
        return False
    
    # ISBN-13 (978 または 979 で始まる13桁)
    if len(isbn) == 13 and isbn.startswith(('978', '979')) and isbn.isdigit():
        return True
    
    # ISBN-10 (10桁、最後の文字はXの可能性あり)
    if len(isbn) == 10 and isbn[:-1].isdigit() and (isbn[-1].isdigit() or isbn[-1] == 'X'):
        return True
    
    return False

# 開発用: ルート
@app.get("/")
async def root():
    return {
        "message": "Book Barcode Scanner API",
        "docs": "/docs",
        "health": "/health"
    }

if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv('FASTAPI_HOST', '127.0.0.1')
    port = int(os.getenv('FASTAPI_PORT', 3001))
    debug = os.getenv('FASTAPI_DEBUG', 'False').lower() == 'true'
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=debug,
        log_level="info"
    )