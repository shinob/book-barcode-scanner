/**
 * @jest-environment jsdom
 */

// fetchのモック
global.fetch = jest.fn();

import { BookAPI } from '../../js/bookApi.js';

describe('BookAPI', () => {
    let bookAPI;

    beforeEach(() => {
        bookAPI = new BookAPI();
        jest.clearAllMocks();
    });

    describe('初期化', () => {
        test('インスタンスが正しく初期化される', () => {
            expect(bookAPI.googleBooksBaseURL).toBe('https://www.googleapis.com/books/v1/volumes');
            expect(bookAPI.backendBaseURL).toBe('http://127.0.0.1:8000');
        });
    });

    describe('書籍情報取得', () => {
        test('Google Books APIから正常に書籍情報を取得できる', async () => {
            const mockResponse = {
                totalItems: 1,
                items: [{
                    id: 'test-id',
                    volumeInfo: {
                        title: 'テスト書籍',
                        authors: ['テスト著者'],
                        publisher: 'テスト出版社',
                        publishedDate: '2023-01-01',
                        imageLinks: {
                            thumbnail: 'http://example.com/image.jpg'
                        }
                    },
                    saleInfo: {
                        listPrice: {
                            amount: 1500,
                            currencyCode: 'JPY'
                        }
                    }
                }]
            };

            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            const result = await bookAPI.getBookInfo('9784123456789');

            expect(result.title).toBe('テスト書籍');
            expect(result.authors).toEqual(['テスト著者']);
            expect(result.publisher).toBe('テスト出版社');
            expect(result.listPrice).toBe(1500);
            expect(result.imageUrl).toBe('https://example.com/image.jpg');
        });

        test('書籍が見つからない場合nullを返す', async () => {
            const mockResponse = {
                totalItems: 0,
                items: []
            };

            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            const result = await bookAPI.getBookInfo('9784123456789');

            expect(result).toBeNull();
        });

        test('APIエラー時に適切な例外をthrowする', async () => {
            fetch.mockResolvedValue({
                ok: false,
                status: 500
            });

            await expect(bookAPI.getBookInfo('9784123456789')).rejects.toThrow();
        });
    });

    describe('Amazon価格取得', () => {
        test('バックエンドAPIから正常に価格を取得できる', async () => {
            const mockResponse = {
                price: 800
            };

            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            const result = await bookAPI.getAmazonPrice('9784123456789');

            expect(result).toBe(800);
            expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:8000/api/amazon-price/9784123456789');
        });

        test('価格が見つからない場合nullを返す', async () => {
            fetch.mockResolvedValue({
                ok: false,
                status: 404
            });

            const result = await bookAPI.getAmazonPrice('9784123456789');

            expect(result).toBeNull();
        });

        test('バックエンドエラー時はnullを返す（警告ログのみ）', async () => {
            fetch.mockRejectedValue(new Error('Network error'));

            const result = await bookAPI.getAmazonPrice('9784123456789');

            expect(result).toBeNull();
        });
    });

    describe('価格情報抽出', () => {
        test('日本円の価格を正しく抽出できる', () => {
            const saleInfo = {
                listPrice: {
                    amount: 1500,
                    currencyCode: 'JPY'
                }
            };

            const result = bookAPI.extractListPrice(saleInfo);

            expect(result).toBe(1500);
        });

        test('USD価格を円に概算変換できる', () => {
            const saleInfo = {
                listPrice: {
                    amount: 10,
                    currencyCode: 'USD'
                }
            };

            const result = bookAPI.extractListPrice(saleInfo);

            expect(result).toBe(1500); // 10 * 150
        });

        test('価格情報がない場合nullを返す', () => {
            const result = bookAPI.extractListPrice(null);
            expect(result).toBeNull();

            const result2 = bookAPI.extractListPrice({});
            expect(result2).toBeNull();
        });
    });

    describe('画像URL取得', () => {
        test('最高解像度の画像URLを取得できる', () => {
            const imageLinks = {
                thumbnail: 'http://example.com/thumb.jpg',
                small: 'http://example.com/small.jpg',
                large: 'http://example.com/large.jpg'
            };

            const result = bookAPI.getBestImageURL(imageLinks);

            expect(result).toBe('https://example.com/large.jpg');
        });

        test('HTTPをHTTPSに変換する', () => {
            const imageLinks = {
                thumbnail: 'http://example.com/thumb.jpg'
            };

            const result = bookAPI.getBestImageURL(imageLinks);

            expect(result).toBe('https://example.com/thumb.jpg');
        });

        test('画像リンクがない場合nullを返す', () => {
            const result = bookAPI.getBestImageURL(null);
            expect(result).toBeNull();

            const result2 = bookAPI.getBestImageURL({});
            expect(result2).toBeNull();
        });
    });

    describe('日付フォーマット', () => {
        test('年のみの日付をフォーマットできる', () => {
            const result = bookAPI.formatPublishedDate('2023');
            expect(result).toBe('2023年');
        });

        test('年月の日付をフォーマットできる', () => {
            const result = bookAPI.formatPublishedDate('2023-01');
            expect(result).toBe('2023年1月');
        });

        test('年月日の日付をフォーマットできる', () => {
            const result = bookAPI.formatPublishedDate('2023-01-15');
            expect(result).toBe('2023年1月15日');
        });

        test('無効な日付は元の文字列を返す', () => {
            const result = bookAPI.formatPublishedDate('invalid-date');
            expect(result).toBe('invalid-date');
        });

        test('null/undefinedの場合nullを返す', () => {
            expect(bookAPI.formatPublishedDate(null)).toBeNull();
            expect(bookAPI.formatPublishedDate(undefined)).toBeNull();
        });
    });

    describe('ISBN正規化', () => {
        test('ハイフン付きISBN-13を正規化できる', () => {
            const result = bookAPI.normalizeISBN('978-4-123-45678-9');
            expect(result).toBe('9784123456789');
        });

        test('ISBN-10をISBN-13に変換できる', () => {
            const result = bookAPI.normalizeISBN('4123456789');
            expect(result).toMatch(/^978\d{10}$/);
        });

        test('既に正規化されたISBNはそのまま返す', () => {
            const result = bookAPI.normalizeISBN('9784123456789');
            expect(result).toBe('9784123456789');
        });
    });

    describe('ISBN-10からISBN-13変換', () => {
        test('チェックディジットが数字のISBN-10を変換できる', () => {
            const result = bookAPI.convertISBN10to13('4123456789');
            expect(result).toMatch(/^978\d{10}$/);
            expect(result.length).toBe(13);
        });

        test('チェックディジットがXのISBN-10を変換できる', () => {
            const result = bookAPI.convertISBN10to13('123456789X');
            expect(result).toMatch(/^978\d{10}$/);
        });
    });

    describe('複数形式検索', () => {
        test('最初の形式で成功した場合その結果を返す', async () => {
            const mockBookInfo = {
                title: 'テスト書籍',
                authors: ['テスト著者']
            };

            // getBookInfoをモック
            const originalGetBookInfo = bookAPI.getBookInfo;
            bookAPI.getBookInfo = jest.fn()
                .mockResolvedValueOnce(mockBookInfo); // 最初の形式で成功

            const result = await bookAPI.searchWithMultipleFormats('978-4-123-45678-9');

            expect(result).toEqual(mockBookInfo);
            expect(bookAPI.getBookInfo).toHaveBeenCalledTimes(1);

            // 元のメソッドを復元
            bookAPI.getBookInfo = originalGetBookInfo;
        });

        test('最初の形式で失敗した場合次の形式を試す', async () => {
            const mockBookInfo = {
                title: 'テスト書籍',
                authors: ['テスト著者']
            };

            // getBookInfoをモック
            const originalGetBookInfo = bookAPI.getBookInfo;
            bookAPI.getBookInfo = jest.fn()
                .mockResolvedValueOnce(null) // 最初の形式で失敗
                .mockResolvedValueOnce(mockBookInfo); // 2番目の形式で成功

            const result = await bookAPI.searchWithMultipleFormats('978-4-123-45678-9');

            expect(result).toEqual(mockBookInfo);
            expect(bookAPI.getBookInfo).toHaveBeenCalledTimes(2);

            // 元のメソッドを復元
            bookAPI.getBookInfo = originalGetBookInfo;
        });

        test('すべての形式で失敗した場合nullを返す', async () => {
            // getBookInfoをモック
            const originalGetBookInfo = bookAPI.getBookInfo;
            bookAPI.getBookInfo = jest.fn()
                .mockResolvedValue(null); // 常に失敗

            const result = await bookAPI.searchWithMultipleFormats('invalid-isbn');

            expect(result).toBeNull();

            // 元のメソッドを復元
            bookAPI.getBookInfo = originalGetBookInfo;
        });
    });

    describe('バッチ処理', () => {
        test('複数ISBNの書籍情報を取得できる', async () => {
            const isbns = ['9784123456789', '9784987654321'];
            const mockResults = [
                { title: '書籍1' },
                { title: '書籍2' }
            ];

            // getBookInfoをモック
            const originalGetBookInfo = bookAPI.getBookInfo;
            bookAPI.getBookInfo = jest.fn()
                .mockResolvedValueOnce(mockResults[0])
                .mockResolvedValueOnce(mockResults[1]);

            const results = await bookAPI.getBooksInfoBatch(isbns, 0); // 遅延なし

            expect(results).toHaveLength(2);
            expect(results[0].isbn).toBe(isbns[0]);
            expect(results[0].bookInfo).toEqual(mockResults[0]);
            expect(results[1].isbn).toBe(isbns[1]);
            expect(results[1].bookInfo).toEqual(mockResults[1]);

            // 元のメソッドを復元
            bookAPI.getBookInfo = originalGetBookInfo;
        });

        test('エラーが発生した場合エラー情報を含む', async () => {
            const isbns = ['9784123456789'];

            // getBookInfoをモック
            const originalGetBookInfo = bookAPI.getBookInfo;
            bookAPI.getBookInfo = jest.fn()
                .mockRejectedValue(new Error('API Error'));

            const results = await bookAPI.getBooksInfoBatch(isbns, 0);

            expect(results).toHaveLength(1);
            expect(results[0].isbn).toBe(isbns[0]);
            expect(results[0].bookInfo).toBeNull();
            expect(results[0].error).toBe('API Error');

            // 元のメソッドを復元
            bookAPI.getBookInfo = originalGetBookInfo;
        });
    });

    describe('遅延処理', () => {
        test('指定された時間だけ待機する', async () => {
            const startTime = Date.now();
            await bookAPI.delay(100);
            const endTime = Date.now();

            expect(endTime - startTime).toBeGreaterThanOrEqual(95); // 少し余裕を持たせる
        });
    });
});