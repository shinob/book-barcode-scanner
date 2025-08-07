/**
 * @jest-environment jsdom
 */

// ZXingライブラリのモック
const mockZXing = {
    BrowserMultiFormatReader: jest.fn(() => ({
        listVideoInputDevices: jest.fn(),
        decodeFromVideoDevice: jest.fn(),
        reset: jest.fn()
    }))
};

// グローバルにZXingを設定
global.ZXing = mockZXing;

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
    });

    afterEach(() => {
        if (scanner) {
            scanner.stopScanning();
        }
    });

    describe('初期化', () => {
        test('インスタンスが正しく初期化される', () => {
            expect(scanner.codeReader).toBeNull();
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
        test('スキャン開始時にカメラデバイス一覧を取得する', async () => {
            const mockCodeReader = {
                listVideoInputDevices: jest.fn().mockResolvedValue([
                    { deviceId: 'device1', label: 'Camera 1' }
                ]),
                decodeFromVideoDevice: jest.fn()
            };
            
            mockZXing.BrowserMultiFormatReader.mockReturnValue(mockCodeReader);
            
            document.getElementById.mockReturnValue({
                srcObject: null
            });

            await scanner.startScanning();

            expect(mockCodeReader.listVideoInputDevices).toHaveBeenCalled();
            expect(mockCodeReader.decodeFromVideoDevice).toHaveBeenCalledWith(
                'device1',
                expect.anything(),
                expect.any(Function)
            );
            expect(scanner.isScanning).toBe(true);
        });

        test('カメラデバイスが見つからない場合エラーをthrowする', async () => {
            const mockCodeReader = {
                listVideoInputDevices: jest.fn().mockResolvedValue([])
            };
            
            mockZXing.BrowserMultiFormatReader.mockReturnValue(mockCodeReader);

            await expect(scanner.startScanning()).rejects.toThrow('カメラデバイスが見つかりません');
        });

        test('スキャン停止時に適切にクリーンアップされる', () => {
            const mockCodeReader = {
                reset: jest.fn()
            };
            
            scanner.codeReader = mockCodeReader;
            scanner.isScanning = true;

            const mockVideoElement = {
                srcObject: {
                    getTracks: jest.fn(() => [
                        { stop: jest.fn() }
                    ])
                }
            };
            
            document.getElementById.mockReturnValue(mockVideoElement);

            scanner.stopScanning();

            expect(scanner.isScanning).toBe(false);
            expect(mockCodeReader.reset).toHaveBeenCalled();
            expect(scanner.codeReader).toBeNull();
        });
    });

    describe('コールバック処理', () => {
        test('スキャン成功時にコールバックが呼ばれる', async () => {
            const mockSuccessCallback = jest.fn();
            scanner.onScanSuccess = mockSuccessCallback;

            const mockCodeReader = {
                listVideoInputDevices: jest.fn().mockResolvedValue([
                    { deviceId: 'device1' }
                ]),
                decodeFromVideoDevice: jest.fn((deviceId, element, callback) => {
                    // スキャン成功をシミュレート
                    const mockResult = {
                        getText: () => '9784123456789'
                    };
                    callback(mockResult, null);
                })
            };

            mockZXing.BrowserMultiFormatReader.mockReturnValue(mockCodeReader);
            document.getElementById.mockReturnValue({ srcObject: null });

            await scanner.startScanning();

            expect(mockSuccessCallback).toHaveBeenCalledWith('9784123456789');
        });

        test('スキャンエラー時にコールバックが呼ばれる', async () => {
            const mockErrorCallback = jest.fn();
            scanner.onScanError = mockErrorCallback;

            const mockCodeReader = {
                listVideoInputDevices: jest.fn().mockResolvedValue([
                    { deviceId: 'device1' }
                ]),
                decodeFromVideoDevice: jest.fn((deviceId, element, callback) => {
                    // NotFoundExceptionではないエラーをシミュレート
                    const error = new Error('Camera error');
                    error.name = 'CameraError';
                    callback(null, error);
                })
            };

            mockZXing.BrowserMultiFormatReader.mockReturnValue(mockCodeReader);
            document.getElementById.mockReturnValue({ srcObject: null });

            await scanner.startScanning();

            expect(mockErrorCallback).toHaveBeenCalledWith(expect.any(Error));
        });

        test('NotFoundExceptionはエラーコールバックを呼ばない', async () => {
            const mockErrorCallback = jest.fn();
            scanner.onScanError = mockErrorCallback;

            const mockCodeReader = {
                listVideoInputDevices: jest.fn().mockResolvedValue([
                    { deviceId: 'device1' }
                ]),
                decodeFromVideoDevice: jest.fn((deviceId, element, callback) => {
                    // NotFoundExceptionをシミュレート（正常な動作）
                    const error = new Error('Not found');
                    error.name = 'NotFoundException';
                    callback(null, error);
                })
            };

            mockZXing.BrowserMultiFormatReader.mockReturnValue(mockCodeReader);
            document.getElementById.mockReturnValue({ srcObject: null });

            await scanner.startScanning();

            expect(mockErrorCallback).not.toHaveBeenCalled();
        });
    });
});