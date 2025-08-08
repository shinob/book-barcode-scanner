/**
 * @jest-environment jsdom
 */

// ZXing-jsライブラリのモック
const mockZXing = {
    BrowserMultiFormatReader: jest.fn().mockImplementation(() => ({
        decodeFromImageElement: jest.fn()
    }))
};

// グローバルにZXingを設定
global.ZXing = mockZXing;

// DOMのモック
const mockCanvas = {
    getContext: jest.fn(() => ({
        drawImage: jest.fn(),
        getImageData: jest.fn(() => ({
            data: new Uint8ClampedArray(4),
            width: 1,
            height: 1
        }))
    })),
    width: 100,
    height: 100
};

const mockBarcodeCanvas = {
    getContext: jest.fn(() => ({
        drawImage: jest.fn(),
        strokeRect: jest.fn()
    })),
    width: 100,
    height: 100,
    style: { display: 'none' }
};

Object.defineProperty(document, 'getElementById', {
    value: jest.fn((id) => {
        if (id === 'canvas') return mockCanvas;
        if (id === 'barcodeCanvas') return mockBarcodeCanvas;
        if (id === 'detectedCode') return { textContent: '' };
        if (id === 'detectedISBN') return { textContent: '' };
        if (id === 'confidence') return { textContent: '' };
        if (id === 'barcodeDetection') return { style: { display: 'none' } };
        return {
            srcObject: null,
            getTracks: jest.fn(() => [])
        };
    })
});

// FileReader のモック
global.FileReader = jest.fn().mockImplementation(() => ({
    readAsDataURL: jest.fn(function(file) {
        setTimeout(() => {
            this.onload && this.onload({
                target: { result: 'data:image/jpeg;base64,fake-data' }
            });
        }, 0);
    }),
    onload: null,
    onerror: null
}));

// Image のモック
global.Image = jest.fn().mockImplementation(() => ({
    onload: null,
    onerror: null,
    src: '',
    width: 100,
    height: 100
}));

// BarcodeScanner クラスのインポート
import { BarcodeScanner } from '../../js/scanner.js';

describe('BarcodeScanner', () => {
    let scanner;

    beforeEach(() => {
        scanner = new BarcodeScanner();
        jest.clearAllMocks();
        
        // navigatorのベースセットアップ
        global.navigator = global.navigator || {};
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('初期化', () => {
        test('インスタンスが正しく初期化される', () => {
            expect(scanner.onScanSuccess).toBeNull();
            expect(scanner.onScanError).toBeNull();
        });
    });

    describe('ISBN抽出', () => {
        test('有効なISBN-13を抽出できる', () => {
            const testCases = [
                '9784123456789',
                '978-4-123-45678-9',
                '978 4 123 45678 9'
            ];

            testCases.forEach(input => {
                const result = scanner.extractISBN(input);
                expect(result).toBe('9784123456789');
            });
        });

        test('有効なISBN-10をISBN-13に変換できる', () => {
            const testCases = [
                '4123456789',
                '4-12-345678-9',
                '412345678X'
            ];

            testCases.forEach(input => {
                const result = scanner.extractISBN(input);
                expect(result).toMatch(/^978\d{10}$/);
            });
        });

        test('無効なISBNはnullを返す', () => {
            const testCases = [
                '123',
                'abcdefghij',
                '12345',
                '980123456789', // 980で始まる無効なEAN
                ''
            ];

            testCases.forEach(input => {
                const result = scanner.extractISBN(input);
                expect(result).toBeNull();
            });
        });
    });

    describe('ISBN変換', () => {
        test('ISBN-10からISBN-13への変換が正しく動作する', () => {
            const result = scanner.convertISBN10to13('4123456789');
            expect(result).toMatch(/^978\d{10}$/);
            expect(result.length).toBe(13);
        });

        test('チェックディジットXを含むISBN-10を正しく変換する', () => {
            const result = scanner.convertISBN10to13('123456789X');
            expect(result).toMatch(/^978\d{10}$/);
        });
    });

    describe('ISBN検証', () => {
        test('有効なISBN-13を検証できる', () => {
            // 実際の有効なISBN-13の例
            const validISBNs = [
                '9784061313361', // 真剣勝負
                '9784087474428'  // ノルウェイの森
            ];

            validISBNs.forEach(isbn => {
                const result = scanner.validateISBN13(isbn);
                expect(result).toBe(true);
            });
        });

        test('無効なISBN-13を検証できる', () => {
            const invalidISBNs = [
                '9784061313360', // 無効なチェックディジット
                '1234567890123', // 形式は正しいが無効
                '978406131336'   // 桁数不足
            ];

            invalidISBNs.forEach(isbn => {
                const result = scanner.validateISBN13(isbn);
                expect(result).toBe(false);
            });
        });

        test('有効なISBN-10を検証できる', () => {
            const validISBNs = [
                '4061313363',  // 有効なISBN-10
                '123456789X'   // Xで終わる有効なISBN-10
            ];

            validISBNs.forEach(isbn => {
                const result = scanner.validateISBN10(isbn);
                expect(result).toBe(true);
            });
        });

        test('無効なISBN-10を検証できる', () => {
            const invalidISBNs = [
                '4061313360',  // 無効なチェックディジット
                '123456789Y',  // Yで終わる無効なISBN
                '123456789'    // 桁数不足
            ];

            invalidISBNs.forEach(isbn => {
                const result = scanner.validateISBN10(isbn);
                expect(result).toBe(false);
            });
        });
    });

    describe('画像スキャン機能', () => {
        test('画像ファイルからバーコードをスキャンできる', async () => {
            const mockFile = new File(['fake-image'], 'test.jpg', { type: 'image/jpeg' });
            const mockResult = {
                getText: jest.fn(() => '9784123456789'),
                getResultPoints: jest.fn(() => [
                    { getX: () => 10, getY: () => 10 },
                    { getX: () => 90, getY: () => 30 }
                ])
            };

            const mockCodeReader = {
                decodeFromImageElement: jest.fn().mockResolvedValue(mockResult)
            };
            mockZXing.BrowserMultiFormatReader.mockReturnValue(mockCodeReader);

            const result = await scanner.scanImageFile(mockFile);

            expect(result).toBe('9784123456789');
            expect(mockCodeReader.decodeFromImageElement).toHaveBeenCalled();
        });

        test('無効なISBNの場合はエラーを投げる', async () => {
            const mockFile = new File(['fake-image'], 'test.jpg', { type: 'image/jpeg' });
            const mockResult = {
                getText: jest.fn(() => '1234567890'), // 無効なISBN
                getResultPoints: jest.fn(() => [])
            };

            const mockCodeReader = {
                decodeFromImageElement: jest.fn().mockResolvedValue(mockResult)
            };
            mockZXing.BrowserMultiFormatReader.mockReturnValue(mockCodeReader);

            await expect(scanner.scanImageFile(mockFile)).rejects.toThrow('有効なISBNバーコードが見つかりませんでした');
        });

        test('バーコード読み取りエラーの場合はエラーを投げる', async () => {
            const mockFile = new File(['fake-image'], 'test.jpg', { type: 'image/jpeg' });
            const mockCodeReader = {
                decodeFromImageElement: jest.fn().mockRejectedValue(new Error('decode failed'))
            };
            mockZXing.BrowserMultiFormatReader.mockReturnValue(mockCodeReader);

            await expect(scanner.scanImageFile(mockFile)).rejects.toThrow('画像からバーコードを読み取れませんでした');
        });
    });

    describe('バーコード表示機能', () => {
        test('検出されたバーコード領域を表示できる', () => {
            const mockResult = {
                getResultPoints: jest.fn(() => [
                    { getX: () => 10, getY: () => 10 },
                    { getX: () => 90, getY: () => 30 }
                ])
            };
            const mockCanvas = document.getElementById('canvas');
            const code = '9784123456789';

            scanner.displayDetectedBarcode(mockResult, mockCanvas, code);

            expect(document.getElementById('detectedCode').textContent).toBe(code);
            expect(document.getElementById('detectedISBN').textContent).toBe(code);
            expect(document.getElementById('confidence').textContent).toBe('成功');
            expect(document.getElementById('barcodeDetection').style.display).toBe('block');
        });

        test('バーコード検出結果を非表示にできる', () => {
            scanner.hideDetectedBarcode();

            expect(document.getElementById('barcodeDetection').style.display).toBe('none');
        });
    });

});