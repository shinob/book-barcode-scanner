/**
 * @jest-environment jsdom
 */

// QuaggaJSライブラリのモック
const mockQuagga = {
    init: jest.fn((config, callback) => {
        setTimeout(() => callback(null), 0);
    }),
    start: jest.fn(),
    stop: jest.fn(),
    onDetected: jest.fn(),
    offDetected: jest.fn()
};

// グローバルにQuaggaを設定
global.Quagga = mockQuagga;

// DOMのモック
Object.defineProperty(document, 'getElementById', {
    value: jest.fn(() => ({
        srcObject: null,
        getTracks: jest.fn(() => [])
    }))
});

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
        if (scanner) {
            scanner.stopScanning();
        }
    });

    describe('初期化', () => {
        test('インスタンスが正しく初期化される', () => {
            expect(scanner.stream).toBeNull();
            expect(scanner.isScanning).toBe(false);
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

    describe('スキャン制御', () => {
        test('QuaggaJSでスキャンを開始できる', async () => {
            const mockVideoElement = { srcObject: null };
            document.getElementById.mockReturnValue(mockVideoElement);

            await scanner.startScanning();

            expect(mockQuagga.init).toHaveBeenCalledWith(
                expect.objectContaining({
                    inputStream: expect.objectContaining({
                        target: mockVideoElement
                    }),
                    decoder: expect.objectContaining({
                        readers: expect.arrayContaining(['ean_13_reader'])
                    })
                }),
                expect.any(Function)
            );
            expect(mockQuagga.start).toHaveBeenCalled();
            expect(mockQuagga.onDetected).toHaveBeenCalled();
            expect(scanner.isScanning).toBe(true);
        });

        test('スキャン停止時に適切にクリーンアップされる', () => {
            scanner.isScanning = true;
            const mockVideoElement = { srcObject: 'mock-stream' };
            document.getElementById.mockReturnValue(mockVideoElement);

            scanner.stopScanning();

            expect(scanner.isScanning).toBe(false);
            expect(mockQuagga.stop).toHaveBeenCalled();
            expect(mockVideoElement.srcObject).toBeNull();
        });
    });

    describe('コールバック処理', () => {
        test('スキャン成功時にコールバックが呼ばれる', () => {
            const mockSuccessCallback = jest.fn();
            scanner.onScanSuccess = mockSuccessCallback;
            scanner.isScanning = true;

            // QuaggaJSのonDetectedコールバックをテスト用に取得
            let detectedCallback;
            mockQuagga.onDetected.mockImplementation((callback) => {
                detectedCallback = callback;
            });

            // スキャナーの初期設定（実際のstartScanningを呼ばずに）
            document.getElementById.mockReturnValue({ srcObject: null });

            // onDetectedコールバックをシミュレート
            if (detectedCallback) {
                detectedCallback({
                    codeResult: {
                        code: '9784123456789'
                    }
                });
            }

            expect(mockSuccessCallback).toHaveBeenCalledWith('9784123456789');
        });
    });
});