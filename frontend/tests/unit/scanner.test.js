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
        test('getUserMediaが利用可能な場合、MediaStreamを直接取得する', async () => {
            // getUserMediaのモック
            const mockStream = { getTracks: jest.fn(() => []) };
            global.navigator.mediaDevices = {
                getUserMedia: jest.fn().mockResolvedValue(mockStream)
            };

            const mockCodeReader = {
                decodeFromVideoDevice: jest.fn(),
                reset: jest.fn()
            };
            
            mockZXing.BrowserMultiFormatReader.mockReturnValue(mockCodeReader);
            
            const mockVideoElement = {
                srcObject: null,
                onloadedmetadata: null,
                play: jest.fn()
            };
            document.getElementById.mockReturnValue(mockVideoElement);

            // startScanningを非同期で開始し、onloadedmetadataを手動で発火
            const scanPromise = scanner.startScanning();
            
            // onloadedmetadataコールバックを実行
            if (mockVideoElement.onloadedmetadata) {
                mockVideoElement.onloadedmetadata();
            }
            
            await scanPromise;

            expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
            expect(mockVideoElement.srcObject).toBe(mockStream);
            expect(mockCodeReader.decodeFromVideoDevice).toHaveBeenCalledWith(
                undefined,
                mockVideoElement,
                expect.any(Function)
            );
            expect(scanner.isScanning).toBe(true);
        });

        test('getUserMediaが失敗した場合、ZXingの標準方法を使用する', async () => {
            // getUserMediaが失敗するようにモック
            global.navigator.mediaDevices = {
                getUserMedia: jest.fn().mockRejectedValue(new Error('Camera not available'))
            };

            const mockCodeReader = {
                decodeFromVideoDevice: jest.fn(),
                reset: jest.fn()
            };
            
            mockZXing.BrowserMultiFormatReader.mockReturnValue(mockCodeReader);
            
            const mockVideoElement = { srcObject: null };
            document.getElementById.mockReturnValue(mockVideoElement);

            await scanner.startScanning();

            expect(mockCodeReader.decodeFromVideoDevice).toHaveBeenCalledWith(
                undefined,
                mockVideoElement,
                expect.any(Function)
            );
            expect(scanner.isScanning).toBe(true);
        });

        test('mediaDevicesが未対応の場合、古いAPIを使用する', async () => {
            // mediaDevicesを未定義に設定
            delete global.navigator.mediaDevices;
            
            // 古いAPIをモック
            const mockStream = { getTracks: jest.fn(() => []) };
            global.navigator.webkitGetUserMedia = jest.fn((constraints, success, error) => {
                success(mockStream);
            });

            const mockCodeReader = {
                decodeFromVideoDevice: jest.fn(),
                reset: jest.fn()
            };
            
            mockZXing.BrowserMultiFormatReader.mockReturnValue(mockCodeReader);
            
            const mockVideoElement = {
                srcObject: null,
                onloadedmetadata: null,
                play: jest.fn()
            };
            document.getElementById.mockReturnValue(mockVideoElement);

            // startScanningを非同期で開始し、onloadedmetadataを手動で発火
            const scanPromise = scanner.startScanning();
            
            // onloadedmetadataコールバックを実行
            if (mockVideoElement.onloadedmetadata) {
                mockVideoElement.onloadedmetadata();
            }
            
            await scanPromise;

            expect(global.navigator.webkitGetUserMedia).toHaveBeenCalled();
            expect(mockVideoElement.srcObject).toBe(mockStream);
            expect(scanner.isScanning).toBe(true);
        });

        test('スキャン停止時に適切にクリーンアップされる', () => {
            const mockCodeReader = {
                reset: jest.fn()
            };
            
            const mockStream = {
                getTracks: jest.fn(() => [
                    { stop: jest.fn() }
                ])
            };
            
            scanner.codeReader = mockCodeReader;
            scanner.stream = mockStream;
            scanner.isScanning = true;

            const mockVideoElement = {
                srcObject: mockStream
            };
            
            document.getElementById.mockReturnValue(mockVideoElement);

            scanner.stopScanning();

            expect(scanner.isScanning).toBe(false);
            expect(mockCodeReader.reset).toHaveBeenCalled();
            expect(scanner.codeReader).toBeNull();
            expect(scanner.stream).toBeNull();
            expect(mockVideoElement.srcObject).toBeNull();
        });
    });

    describe('コールバック処理', () => {
        beforeEach(() => {
            // MediaDevicesをフォールバック状態に設定（カメラなし）
            delete global.navigator.mediaDevices;
            delete global.navigator.webkitGetUserMedia;
        });

        test('スキャン成功時にコールバックが呼ばれる', async () => {
            const mockSuccessCallback = jest.fn();
            scanner.onScanSuccess = mockSuccessCallback;

            const mockCodeReader = {
                decodeFromVideoDevice: jest.fn((deviceId, element, callback) => {
                    // スキャン成功をシミュレート
                    const mockResult = {
                        getText: () => '9784123456789'
                    };
                    callback(mockResult, null);
                }),
                reset: jest.fn()
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
                decodeFromVideoDevice: jest.fn((deviceId, element, callback) => {
                    // NotFoundExceptionではないエラーをシミュレート
                    const error = new Error('Camera error');
                    error.name = 'CameraError';
                    callback(null, error);
                }),
                reset: jest.fn()
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
                decodeFromVideoDevice: jest.fn((deviceId, element, callback) => {
                    // NotFoundExceptionをシミュレート（正常な動作）
                    const error = new Error('Not found');
                    error.name = 'NotFoundException';
                    callback(null, error);
                }),
                reset: jest.fn()
            };

            mockZXing.BrowserMultiFormatReader.mockReturnValue(mockCodeReader);
            document.getElementById.mockReturnValue({ srcObject: null });

            await scanner.startScanning();

            expect(mockErrorCallback).not.toHaveBeenCalled();
        });
    });
});