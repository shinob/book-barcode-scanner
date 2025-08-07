export class BookAPI {
    constructor() {
        this.googleBooksBaseURL = 'https://www.googleapis.com/books/v1/volumes';
        this.backendBaseURL = 'http://127.0.0.1:3001'; // FastAPIサーバーのURL
    }

    async getBookInfo(isbn) {
        try {
            // Google Books APIから書籍情報を取得
            const response = await fetch(`${this.googleBooksBaseURL}?q=isbn:${isbn}`);
            
            if (!response.ok) {
                throw new Error(`Google Books API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.totalItems === 0) {
                return null; // 書籍が見つからない
            }

            const book = data.items[0];
            const volumeInfo = book.volumeInfo;
            const saleInfo = book.saleInfo;

            // 書籍情報を整理
            const bookInfo = {
                title: volumeInfo.title || 'タイトル不明',
                authors: volumeInfo.authors || [],
                publisher: volumeInfo.publisher || null,
                publishedDate: this.formatPublishedDate(volumeInfo.publishedDate),
                listPrice: this.extractListPrice(saleInfo),
                imageUrl: this.getBestImageURL(volumeInfo.imageLinks),
                description: volumeInfo.description || null,
                pageCount: volumeInfo.pageCount || null,
                categories: volumeInfo.categories || [],
                language: volumeInfo.language || null,
                googleBooksId: book.id
            };

            return bookInfo;

        } catch (error) {
            console.error('Error fetching book info from Google Books:', error);
            throw new Error(`書籍情報の取得に失敗しました: ${error.message}`);
        }
    }

    async getAmazonPrice(isbn) {
        try {
            // バックエンドAPIからAmazon価格を取得
            const response = await fetch(`${this.backendBaseURL}/api/amazon-price/${isbn}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    return null; // 価格情報が見つからない
                }
                throw new Error(`Backend API error: ${response.status}`);
            }

            const data = await response.json();
            return data.price;

        } catch (error) {
            // バックエンドが利用できない場合は警告ログのみ出力
            console.warn('Amazon price fetch failed:', error.message);
            return null;
        }
    }

    extractListPrice(saleInfo) {
        if (!saleInfo) return null;
        
        // 日本の価格情報を優先
        if (saleInfo.listPrice) {
            if (saleInfo.listPrice.currencyCode === 'JPY') {
                return saleInfo.listPrice.amount;
            }
            // 他の通貨の場合は概算で円換算（簡易的な換算）
            if (saleInfo.listPrice.currencyCode === 'USD') {
                return Math.round(saleInfo.listPrice.amount * 150); // 1USD = 150円と仮定
            }
        }

        // 小売価格が利用できない場合
        if (saleInfo.retailPrice && saleInfo.retailPrice.currencyCode === 'JPY') {
            return saleInfo.retailPrice.amount;
        }

        return null;
    }

    getBestImageURL(imageLinks) {
        if (!imageLinks) return null;
        
        // 高解像度の画像を優先的に選択
        const priorities = ['extraLarge', 'large', 'medium', 'small', 'thumbnail', 'smallThumbnail'];
        
        for (const priority of priorities) {
            if (imageLinks[priority]) {
                // HTTPSに変換
                return imageLinks[priority].replace('http://', 'https://');
            }
        }
        
        return null;
    }

    formatPublishedDate(dateString) {
        if (!dateString) return null;
        
        try {
            // YYYY, YYYY-MM, YYYY-MM-DD 形式に対応
            if (dateString.length === 4) {
                return `${dateString}年`;
            } else if (dateString.length === 7) {
                const [year, month] = dateString.split('-');
                return `${year}年${parseInt(month)}月`;
            } else if (dateString.length === 10) {
                const [year, month, day] = dateString.split('-');
                return `${year}年${parseInt(month)}月${parseInt(day)}日`;
            } else {
                // 不正な形式の場合は元の文字列をそのまま返す
                return dateString;
            }
        } catch (error) {
            console.warn('Date format error:', error);
            return dateString;
        }
    }

    // ISBNの正規化（ハイフン除去、チェックディジット検証）
    normalizeISBN(isbn) {
        const cleaned = isbn.replace(/[-\s]/g, '');
        
        // ISBN-13の場合
        if (/^97[89]\d{10}$/.test(cleaned)) {
            return cleaned;
        }
        
        // ISBN-10の場合はISBN-13に変換
        if (/^\d{9}[\dX]$/.test(cleaned)) {
            return this.convertISBN10to13(cleaned);
        }
        
        return cleaned;
    }

    convertISBN10to13(isbn10) {
        const isbn10_digits = isbn10.slice(0, 9);
        const isbn13_prefix = '978' + isbn10_digits;
        
        let sum = 0;
        for (let i = 0; i < 12; i++) {
            const digit = parseInt(isbn13_prefix[i]);
            sum += (i % 2 === 0) ? digit : digit * 3;
        }
        
        const checkDigit = (10 - (sum % 10)) % 10;
        return isbn13_prefix + checkDigit;
    }

    // 複数のISBNで検索を試行する
    async searchWithMultipleFormats(isbn) {
        const formats = [
            isbn,
            this.normalizeISBN(isbn),
            isbn.replace(/[-\s]/g, ''), // ハイフン除去版
        ];

        // 重複を除去
        const uniqueFormats = [...new Set(formats)];

        for (const format of uniqueFormats) {
            try {
                const result = await this.getBookInfo(format);
                if (result) {
                    return result;
                }
            } catch (error) {
                console.warn(`Search failed for format ${format}:`, error);
            }
        }

        return null;
    }

    // レート制限対応のための遅延処理
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // バッチで複数の書籍情報を取得
    async getBooksInfoBatch(isbns, delayMs = 100) {
        const results = [];
        
        for (const isbn of isbns) {
            try {
                const bookInfo = await this.getBookInfo(isbn);
                results.push({ isbn, bookInfo, error: null });
            } catch (error) {
                results.push({ isbn, bookInfo: null, error: error.message });
            }
            
            // レート制限を避けるための遅延
            if (delayMs > 0) {
                await this.delay(delayMs);
            }
        }
        
        return results;
    }
}