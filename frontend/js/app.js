import { BarcodeScanner } from './scanner.js';
import { BookAPI } from './bookApi.js';
import { ExportManager } from './export.js';

class BookBarcodeApp {
    constructor() {
        this.books = [];
        this.scanner = new BarcodeScanner();
        this.bookAPI = new BookAPI();
        this.exportManager = new ExportManager();
        
        this.init();
    }

    init() {
        this.loadBooksFromStorage();
        this.setupEventListeners();
        this.renderBookList();
    }

    setupEventListeners() {
        // スキャンボタン
        document.getElementById('startScanBtn').addEventListener('click', () => this.startScanning());
        document.getElementById('stopScanBtn').addEventListener('click', () => this.stopScanning());
        
        // 画像アップロード
        document.getElementById('imageUpload').addEventListener('change', (e) => this.handleImageUpload(e));
        
        // 手動入力
        document.getElementById('manualInputBtn').addEventListener('click', () => this.openManualInput());
        document.getElementById('searchManualBtn').addEventListener('click', () => this.searchManualISBN());
        
        // エクスポートボタン
        document.getElementById('exportExcelBtn').addEventListener('click', () => this.exportExcel());
        document.getElementById('exportCsvBtn').addEventListener('click', () => this.exportCSV());
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAllBooks());
        
        // モーダル制御
        document.querySelector('.close').addEventListener('click', () => this.closeManualInput());
        document.getElementById('manualModal').addEventListener('click', (e) => {
            if (e.target.id === 'manualModal') this.closeManualInput();
        });
        
        // Enter キー対応
        document.getElementById('manualIsbn').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchManualISBN();
        });

        // スキャン結果のイベントリスナー
        this.scanner.onScanSuccess = (isbn) => this.handleScanSuccess(isbn);
        this.scanner.onScanError = (error) => this.handleScanError(error);
    }

    async startScanning() {
        try {
            await this.scanner.startScanning();
            document.getElementById('startScanBtn').style.display = 'none';
            document.getElementById('stopScanBtn').style.display = 'inline-block';
            this.showScanResult('カメラが起動しました。バーコードをカメラに向けてください。', 'success');
        } catch (error) {
            this.showScanResult(`カメラの起動に失敗しました: ${error.message}`, 'error');
        }
    }

    stopScanning() {
        this.scanner.stopScanning();
        document.getElementById('startScanBtn').style.display = 'inline-block';
        document.getElementById('stopScanBtn').style.display = 'none';
        this.showScanResult('スキャンを停止しました。', 'success');
    }

    async handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // ファイルタイプチェック
        if (!file.type.startsWith('image/')) {
            this.showScanResult('画像ファイルを選択してください。', 'error');
            return;
        }

        // 前回の検出結果をクリア
        this.scanner.hideDetectedBarcode();

        this.showScanResult('画像を解析中...', 'success');
        this.showLoading(true);

        try {
            const isbn = await this.scanner.scanImageFile(file);
            
            if (isbn) {
                this.showScanResult(`ISBN: ${isbn} が検出されました。書籍情報を取得中...`, 'success');
                await this.searchBookByISBN(isbn);
            } else {
                this.showScanResult('有効なISBNバーコードが見つかりませんでした。', 'error');
            }
        } catch (error) {
            console.error('Image scan error:', error);
            this.showScanResult(`画像読み取りに失敗しました: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
            // ファイル入力をリセット
            event.target.value = '';
        }
    }

    async handleScanSuccess(isbn) {
        // 重複チェック
        if (this.books.some(book => book.isbn === isbn)) {
            this.showScanResult(`ISBN: ${isbn} は既に追加されています。`, 'error');
            return;
        }

        this.showScanResult(`ISBN: ${isbn} が検出されました。書籍情報を取得中...`, 'success');
        await this.searchBookByISBN(isbn);
    }

    handleScanError(error) {
        console.warn('Scan error:', error);
        // ユーザーには詳細なエラーを表示しない（スキャンは連続的に行われるため）
    }

    async searchBookByISBN(isbn) {
        this.showLoading(true);
        
        try {
            const bookInfo = await this.bookAPI.getBookInfo(isbn);
            
            if (bookInfo) {
                // Amazon価格を取得（バックエンドAPIが利用可能な場合）
                let amazonPrice = null;
                try {
                    amazonPrice = await this.bookAPI.getAmazonPrice(isbn);
                } catch (error) {
                    console.warn('Amazon price fetch failed:', error);
                }

                const book = {
                    id: Date.now().toString(),
                    isbn: isbn,
                    title: bookInfo.title,
                    authors: bookInfo.authors,
                    publisher: bookInfo.publisher,
                    publishedDate: bookInfo.publishedDate,
                    listPrice: bookInfo.listPrice,
                    imageUrl: bookInfo.imageUrl,
                    amazonPrice: amazonPrice,
                    addedAt: new Date().toISOString()
                };

                this.addBook(book);
                this.showScanResult(`「${book.title}」を追加しました。`, 'success');
            } else {
                this.showScanResult(`ISBN: ${isbn} の書籍情報が見つかりませんでした。`, 'error');
            }
        } catch (error) {
            console.error('Book search error:', error);
            this.showScanResult(`書籍情報の取得に失敗しました: ${error.message}`, 'error');
        }
        
        this.showLoading(false);
    }

    addBook(book) {
        this.books.unshift(book); // 新しい書籍を先頭に追加
        this.saveBooksToStorage();
        this.renderBookList();
    }

    removeBook(bookId) {
        this.books = this.books.filter(book => book.id !== bookId);
        this.saveBooksToStorage();
        this.renderBookList();
    }

    clearAllBooks() {
        if (this.books.length === 0) {
            alert('削除する書籍がありません。');
            return;
        }
        
        if (confirm('すべての書籍を削除しますか？この操作は取り消せません。')) {
            this.books = [];
            this.saveBooksToStorage();
            this.renderBookList();
            this.showScanResult('すべての書籍を削除しました。', 'success');
        }
    }

    renderBookList() {
        const bookListContainer = document.getElementById('bookList');
        
        if (this.books.length === 0) {
            bookListContainer.innerHTML = '<p class="no-books">まだ書籍がスキャンされていません</p>';
            return;
        }

        const booksHTML = this.books.map(book => this.createBookItemHTML(book)).join('');
        bookListContainer.innerHTML = booksHTML;

        // 削除ボタンのイベントリスナーを設定
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const bookId = e.target.dataset.bookId;
                this.removeBook(bookId);
            });
        });
    }

    createBookItemHTML(book) {
        const priceDiff = this.calculatePriceDifference(book.listPrice, book.amazonPrice);
        const profitClass = priceDiff > 0 ? 'profit' : priceDiff < 0 ? 'loss' : '';

        return `
            <div class="book-item">
                <div class="book-header">
                    <img src="${book.imageUrl || 'https://via.placeholder.com/60x90?text=No+Image'}" 
                         alt="${book.title}" class="book-image" loading="lazy">
                    <div class="book-info">
                        <div class="book-title">${this.escapeHtml(book.title)}</div>
                        <div class="book-author">${this.escapeHtml(book.authors?.join(', ') || '著者不明')}</div>
                    </div>
                    <button class="remove-btn" data-book-id="${book.id}">削除</button>
                </div>
                <div class="book-details">
                    <div class="book-detail">
                        <span class="label">定価</span>
                        <span class="value">¥${book.listPrice?.toLocaleString() || '不明'}</span>
                    </div>
                    <div class="book-detail">
                        <span class="label">Amazon中古</span>
                        <span class="value">¥${book.amazonPrice?.toLocaleString() || '取得中'}</span>
                    </div>
                    <div class="book-detail ${profitClass}">
                        <span class="label">価格差</span>
                        <span class="value">${this.formatPriceDifference(priceDiff)}</span>
                    </div>
                    <div class="book-detail">
                        <span class="label">出版社</span>
                        <span class="value">${this.escapeHtml(book.publisher || '不明')}</span>
                    </div>
                    <div class="book-detail">
                        <span class="label">出版日</span>
                        <span class="value">${book.publishedDate || '不明'}</span>
                    </div>
                    <div class="book-detail">
                        <span class="label">ISBN</span>
                        <span class="value">${book.isbn}</span>
                    </div>
                </div>
            </div>
        `;
    }

    calculatePriceDifference(listPrice, amazonPrice) {
        if (!listPrice || !amazonPrice) return 0;
        return listPrice - amazonPrice;
    }

    formatPriceDifference(diff) {
        if (diff === 0) return '¥0';
        const sign = diff > 0 ? '+' : '';
        return `${sign}¥${diff.toLocaleString()}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 手動入力関連
    openManualInput() {
        document.getElementById('manualModal').style.display = 'block';
        document.getElementById('manualIsbn').focus();
    }

    closeManualInput() {
        document.getElementById('manualModal').style.display = 'none';
        document.getElementById('manualIsbn').value = '';
    }

    async searchManualISBN() {
        const isbn = document.getElementById('manualIsbn').value.trim().replace(/-/g, '');
        
        if (!isbn) {
            alert('ISBNを入力してください。');
            return;
        }

        if (!/^(97[89])?\d{9}[\dX]$/.test(isbn)) {
            alert('正しいISBN形式で入力してください。（例: 9784123456789）');
            return;
        }

        this.closeManualInput();
        await this.searchBookByISBN(isbn);
    }

    // エクスポート関連
    exportExcel() {
        if (this.books.length === 0) {
            alert('エクスポートする書籍がありません。');
            return;
        }
        this.exportManager.exportToExcel(this.books);
    }

    exportCSV() {
        if (this.books.length === 0) {
            alert('エクスポートする書籍がありません。');
            return;
        }
        this.exportManager.exportToCSV(this.books);
    }

    // ユーティリティ
    showScanResult(message, type) {
        const resultDiv = document.getElementById('scanResult');
        resultDiv.textContent = message;
        resultDiv.className = `scan-result ${type}`;
        
        // 5秒後に自動で非表示
        setTimeout(() => {
            if (resultDiv.textContent === message) {
                resultDiv.textContent = '';
                resultDiv.className = 'scan-result';
            }
        }, 5000);
    }

    showLoading(show) {
        document.getElementById('loadingOverlay').style.display = show ? 'block' : 'none';
    }

    // ローカルストレージ
    saveBooksToStorage() {
        try {
            localStorage.setItem('scannedBooks', JSON.stringify(this.books));
        } catch (error) {
            console.error('Failed to save books to localStorage:', error);
        }
    }

    loadBooksFromStorage() {
        try {
            const saved = localStorage.getItem('scannedBooks');
            if (saved) {
                this.books = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Failed to load books from localStorage:', error);
            this.books = [];
        }
    }
}

// アプリケーション開始
document.addEventListener('DOMContentLoaded', () => {
    new BookBarcodeApp();
});