export class BarcodeScanner {
    constructor() {
        this.isScanning = false;
        this.stream = null;
        
        this.onScanSuccess = null;
        this.onScanError = null;
    }

    async startScanning() {
        try {
            console.log('Starting QuaggaJS barcode scanner...');
            
            // スキャン開始
            this.isScanning = true;
            
            const videoElement = document.getElementById('video');
            
            // QuaggaJSの設定
            const config = {
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: videoElement,
                    constraints: {
                        width: 640,
                        height: 480,
                        facingMode: "environment"
                    }
                },
                locator: {
                    patchSize: "medium",
                    halfSample: true
                },
                numOfWorkers: 2,
                frequency: 10,
                decoder: {
                    readers: [
                        "ean_reader",
                        "ean_8_reader",
                        "ean_13_reader"
                    ]
                },
                locate: true
            };

            // QuaggaJSを初期化
            await new Promise((resolve, reject) => {
                Quagga.init(config, (err) => {
                    if (err) {
                        console.error('QuaggaJS initialization failed:', err);
                        reject(err);
                    } else {
                        console.log('QuaggaJS initialization successful');
                        resolve();
                    }
                });
            });

            // スキャン結果のイベントリスナー
            Quagga.onDetected((result) => {
                if (this.isScanning && result.codeResult) {
                    const code = result.codeResult.code;
                    console.log('Barcode detected:', code);
                    
                    const isbn = this.extractISBN(code);
                    if (isbn && this.onScanSuccess) {
                        this.onScanSuccess(isbn);
                    }
                }
            });

            // スキャン開始
            Quagga.start();
            console.log('QuaggaJS scanning started');

        } catch (error) {
            this.isScanning = false;
            console.error('Scanner start failed:', error);
            throw error;
        }
    }

    async scanImageFile(file) {
        try {
            console.log('Scanning image file:', file.name);
            
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const canvas = document.getElementById('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    
                    img.onload = () => {
                        // Canvasにサイズを設定
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx.drawImage(img, 0, 0);
                        
                        // QuaggaJSで画像をスキャン
                        const config = {
                            inputStream: {
                                name: "Image",
                                type: "ImageStream",
                                src: canvas
                            },
                            locator: {
                                patchSize: "medium",
                                halfSample: true
                            },
                            numOfWorkers: 1,
                            decoder: {
                                readers: [
                                    "ean_reader",
                                    "ean_8_reader", 
                                    "ean_13_reader"
                                ]
                            },
                            locate: true
                        };
                        
                        Quagga.decodeSingle(config, (result) => {
                            if (result && result.codeResult) {
                                const code = result.codeResult.code;
                                console.log('Barcode detected in image:', code);
                                
                                const isbn = this.extractISBN(code);
                                if (isbn) {
                                    resolve(isbn);
                                } else {
                                    reject(new Error('有効なISBNバーコードが見つかりませんでした'));
                                }
                            } else {
                                reject(new Error('画像からバーコードを読み取れませんでした'));
                            }
                        });
                    };
                    
                    img.onerror = () => {
                        reject(new Error('画像の読み込みに失敗しました'));
                    };
                    
                    img.src = e.target.result;
                };
                
                reader.onerror = () => {
                    reject(new Error('ファイルの読み込みに失敗しました'));
                };
                
                reader.readAsDataURL(file);
            });
            
        } catch (error) {
            console.error('Image scan failed:', error);
            throw error;
        }
    }

    stopScanning() {
        this.isScanning = false;
        
        try {
            // QuaggaJSを停止
            Quagga.stop();
            console.log('QuaggaJS scanning stopped');
        } catch (error) {
            console.warn('Error stopping scanner:', error);
        }

        // ビデオストリームをクリーンアップ
        const videoElement = document.getElementById('video');
        if (videoElement.srcObject) {
            videoElement.srcObject = null;
        }
    }

    extractISBN(text) {
        // ISBNの抽出と検証
        // ハイフンを除去
        const cleaned = text.replace(/[-\s]/g, '');
        
        // ISBN-13 (978 または 979 で始まる13桁)
        if (/^97[89]\d{10}$/.test(cleaned)) {
            return cleaned;
        }
        
        // ISBN-10 (10桁、最後の文字はXの可能性あり)
        if (/^\d{9}[\dX]$/.test(cleaned)) {
            // ISBN-10をISBN-13に変換
            return this.convertISBN10to13(cleaned);
        }
        
        // EAN-13コードの場合もISBNとして処理
        if (/^\d{13}$/.test(cleaned) && (cleaned.startsWith('978') || cleaned.startsWith('979'))) {
            return cleaned;
        }
        
        return null;
    }

    convertISBN10to13(isbn10) {
        // ISBN-10をISBN-13に変換
        const isbn10_digits = isbn10.slice(0, 9); // チェックディジットを除く9桁
        const isbn13_prefix = '978' + isbn10_digits;
        
        // ISBN-13のチェックディジットを計算
        let sum = 0;
        for (let i = 0; i < 12; i++) {
            const digit = parseInt(isbn13_prefix[i]);
            sum += (i % 2 === 0) ? digit : digit * 3;
        }
        
        const checkDigit = (10 - (sum % 10)) % 10;
        return isbn13_prefix + checkDigit;
    }

    validateISBN13(isbn13) {
        if (!/^\d{13}$/.test(isbn13)) {
            return false;
        }
        
        let sum = 0;
        for (let i = 0; i < 12; i++) {
            const digit = parseInt(isbn13[i]);
            sum += (i % 2 === 0) ? digit : digit * 3;
        }
        
        const checkDigit = (10 - (sum % 10)) % 10;
        return checkDigit === parseInt(isbn13[12]);
    }

    validateISBN10(isbn10) {
        if (!/^\d{9}[\dX]$/.test(isbn10)) {
            return false;
        }
        
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += parseInt(isbn10[i]) * (10 - i);
        }
        
        const remainder = sum % 11;
        const checkDigit = remainder === 0 ? 0 : 11 - remainder;
        const lastChar = isbn10[9];
        
        return (checkDigit === 10 && lastChar === 'X') || 
               (checkDigit < 10 && parseInt(lastChar) === checkDigit);
    }
}