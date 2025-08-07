import asyncio
import re
import logging
from typing import Optional, Dict, Any
import httpx
from bs4 import BeautifulSoup
from urllib.parse import quote_plus
import random

logger = logging.getLogger(__name__)

class AmazonPriceAPI:
    """Amazon価格取得API
    
    注意: このクラスはWebスクレイピングを使用しています。
    本番環境では適切な利用制限を設けてください。
    可能であればAmazon Product Advertising APIの利用を推奨します。
    """
    
    def __init__(self):
        self.base_url = "https://www.amazon.co.jp"
        self.session = None
        
        # ユーザーエージェントのローテーション
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ]
    
    async def get_session(self) -> httpx.AsyncClient:
        """HTTPクライアントセッションを取得"""
        if self.session is None or self.session.is_closed:
            self.session = httpx.AsyncClient(
                headers={
                    'User-Agent': random.choice(self.user_agents),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                },
                timeout=30.0,
                follow_redirects=True
            )
        return self.session
    
    async def get_price(self, isbn: str) -> Optional[Dict[str, Any]]:
        """ISBNから最安中古価格を取得
        
        Args:
            isbn: ISBN-10 または ISBN-13
            
        Returns:
            価格情報辞書 または None
        """
        try:
            session = await self.get_session()
            
            # 検索URL構築
            search_url = f"{self.base_url}/s"
            params = {
                'k': isbn,
                'i': 'stripbooks',
                'ref': 'sr_nr_n_1'
            }
            
            logger.info(f"Searching Amazon for ISBN: {isbn}")
            
            # 検索実行
            response = await session.get(search_url, params=params)
            response.raise_for_status()
            
            # 検索結果から商品URLを取得
            product_url = await self._extract_product_url(response.text)
            
            if not product_url:
                logger.warning(f"Product not found for ISBN: {isbn}")
                return None
            
            # 商品詳細ページから価格を取得
            return await self._extract_price_from_product_page(product_url)
        
        except Exception as e:
            logger.error(f"Error fetching Amazon price for {isbn}: {str(e)}")
            return None
    
    async def _extract_product_url(self, html_content: str) -> Optional[str]:
        """検索結果から最初の商品URLを抽出"""
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # 商品リンクを検索
            product_links = soup.find_all('a', {'class': re.compile(r'.*s-link.*')})
            
            if not product_links:
                # 別の形式のリンクを試す
                product_links = soup.find_all('h2', class_='s-size-mini')
                if product_links:
                    link = product_links[0].find('a')
                    if link:
                        product_links = [link]
            
            for link in product_links[:3]:  # 上位3件まで試行
                href = link.get('href')
                if href and '/dp/' in href:
                    if href.startswith('/'):
                        return f"{self.base_url}{href}"
                    return href
            
            return None
        
        except Exception as e:
            logger.error(f"Error extracting product URL: {str(e)}")
            return None
    
    async def _extract_price_from_product_page(self, product_url: str) -> Optional[Dict[str, Any]]:
        """商品詳細ページから中古価格を抽出"""
        try:
            session = await self.get_session()
            
            # リクエスト間の遅延（レート制限対策）
            await asyncio.sleep(random.uniform(1.0, 2.0))
            
            response = await session.get(product_url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 中古価格の抽出を試行
            price_info = await self._try_extract_used_price(soup)
            
            if price_info:
                logger.info(f"Found price: ¥{price_info['price']} for {product_url}")
            else:
                logger.warning(f"No used price found for {product_url}")
            
            return price_info
        
        except Exception as e:
            logger.error(f"Error extracting price from product page: {str(e)}")
            return None
    
    async def _try_extract_used_price(self, soup: BeautifulSoup) -> Optional[Dict[str, Any]]:
        """複数のセレクターで中古価格の抽出を試行"""
        
        # 中古価格を示す可能性のあるセレクター群
        price_selectors = [
            # 中古価格セクション
            {'selector': '#usedAccordionRow .a-price .a-offscreen', 'type': 'used'},
            {'selector': '[data-feature-name="usedAccordion"] .a-price .a-offscreen', 'type': 'used'},
            
            # 「他の販売者」セクション
            {'selector': '#mbc .a-price .a-offscreen', 'type': 'marketplace'},
            {'selector': '[data-feature-name="moreBuyingChoices"] .a-price .a-offscreen', 'type': 'marketplace'},
            
            # 一般的な価格表示
            {'selector': '.a-price.a-text-price.a-size-medium .a-offscreen', 'type': 'general'},
            {'selector': '.a-price .a-offscreen', 'type': 'general'},
        ]
        
        for selector_info in price_selectors:
            try:
                price_elements = soup.select(selector_info['selector'])
                
                for element in price_elements:
                    price_text = element.get_text().strip()
                    price = self._parse_price(price_text)
                    
                    if price and price > 0:
                        return {
                            'price': price,
                            'currency': 'JPY',
                            'availability': 'available',
                            'type': selector_info['type']
                        }
            
            except Exception as e:
                logger.debug(f"Error with selector {selector_info['selector']}: {str(e)}")
                continue
        
        return None
    
    def _parse_price(self, price_text: str) -> Optional[int]:
        """価格文字列から数値を抽出"""
        if not price_text:
            return None
        
        try:
            # 日本語の価格形式に対応 (例: ￥1,234, ¥1,234)
            price_text = price_text.replace('￥', '').replace('¥', '').replace(',', '').strip()
            
            # 数字のみ抽出
            numbers = re.findall(r'\d+', price_text)
            
            if numbers:
                return int(numbers[0])
        
        except Exception as e:
            logger.debug(f"Error parsing price '{price_text}': {str(e)}")
        
        return None
    
    async def close(self):
        """セッションを閉じる"""
        if self.session and not self.session.is_closed:
            await self.session.aclose()
            self.session = None
    
    def __del__(self):
        """デストラクタでセッションをクリーンアップ"""
        if self.session and not self.session.is_closed:
            try:
                asyncio.create_task(self.session.aclose())
            except RuntimeError:
                # イベントループが実行されていない場合は無視
                pass

# 注意とコンプライアンス情報
"""
注意事項:

1. このコードはWebスクレイピングを使用してAmazonから価格情報を取得します。
2. Amazonの利用規約に従って使用してください。
3. 過度なリクエストは避け、適切なレート制限を実装してください。
4. 本番環境では以下の対策を推奨します：
   - Amazon Product Advertising APIの使用
   - プロキシサーバーの使用
   - キャッシュ機能の実装
   - エラー処理の強化
5. このコードは教育目的で提供されており、商用利用には適切な許可が必要です。

推奨事項:
- 可能な限りAmazon Product Advertising APIを使用する
- リクエスト頻度を制限する（例：1秒間に1リクエスト以下）
- ユーザーエージェントとIPアドレスをローテーションする
- 結果をキャッシュして重複リクエストを避ける
"""