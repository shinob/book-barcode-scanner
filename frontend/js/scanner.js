export class BarcodeScanner {
    constructor() {
        this.onScanSuccess = null;
        this.onScanError = null;
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
                    
                    img.onload = async () => {
                        try {
                            // Canvasにサイズを設定
                            canvas.width = img.width;
                            canvas.height = img.height;
                            ctx.drawImage(img, 0, 0);
                            
                            // ImageDataを取得
                            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                            
                            // ZXing-jsで読み取り
                            const codeReader = new ZXing.BrowserMultiFormatReader();
                            
                            try {
                                const result = await codeReader.decodeFromImageElement(img);
                                const code = result.getText();
                                console.log('Barcode detected in image:', code);
                                
                                // バーコード領域を表示
                                this.displayDetectedBarcode(result, canvas, code);
                                
                                const isbn = this.extractISBN(code);
                                if (isbn) {
                                    resolve(isbn);
                                } else {
                                    reject(new Error('有効なISBNバーコードが見つかりませんでした'));
                                }
                            } catch (decodeError) {
                                console.warn('ZXing decode error:', decodeError);
                                reject(new Error('画像からバーコードを読み取れませんでした'));
                            }
                            
                        } catch (processError) {
                            console.error('Image processing error:', processError);
                            reject(processError);
                        }
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

    displayDetectedBarcode(result, sourceCanvas, code) {
        try {
            // ZXing-jsの結果からバウンディングボックスを取得
            const resultPoints = result.getResultPoints();
            
            if (resultPoints && resultPoints.length >= 2) {
                // バーコード領域の境界を計算
                const xs = resultPoints.map(p => p.getX());
                const ys = resultPoints.map(p => p.getY());
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);
                
                const width = maxX - minX;
                const height = maxY - minY;
                
                // マージンを追加
                const margin = 30;
                const cropX = Math.max(0, minX - margin);
                const cropY = Math.max(0, minY - margin);
                const cropWidth = Math.min(sourceCanvas.width - cropX, width + margin * 2);
                const cropHeight = Math.min(sourceCanvas.height - cropY, height + margin * 2);

                // バーコード表示用キャンバスを取得
                const barcodeCanvas = document.getElementById('barcodeCanvas');
                const ctx = barcodeCanvas.getContext('2d');
                
                // キャンバスサイズを設定
                barcodeCanvas.width = cropWidth;
                barcodeCanvas.height = cropHeight;
                
                // バーコード領域を切り出し
                ctx.drawImage(sourceCanvas, 
                    cropX, cropY, cropWidth, cropHeight,
                    0, 0, cropWidth, cropHeight
                );
                
                // 検出枠を描画
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 3;
                ctx.strokeRect(minX - cropX, minY - cropY, width, height);
                
                console.log('バーコード領域を表示:', {
                    code: code,
                    points: resultPoints.length,
                    crop: { x: cropX, y: cropY, width: cropWidth, height: cropHeight }
                });
            } else {
                // 結果点がない場合は全体を表示
                const barcodeCanvas = document.getElementById('barcodeCanvas');
                const ctx = barcodeCanvas.getContext('2d');
                
                barcodeCanvas.width = sourceCanvas.width;
                barcodeCanvas.height = sourceCanvas.height;
                ctx.drawImage(sourceCanvas, 0, 0);
                
                console.log('バーコード全体を表示 (結果点なし)');
            }
            
            // 情報を表示
            document.getElementById('detectedCode').textContent = code;
            document.getElementById('detectedISBN').textContent = this.extractISBN(code) || 'なし';
            document.getElementById('confidence').textContent = '成功';
            
            // 検出結果エリアを表示
            document.getElementById('barcodeDetection').style.display = 'block';
            
        } catch (error) {
            console.warn('バーコード領域の表示に失敗:', error);
        }
    }

    hideDetectedBarcode() {
        document.getElementById('barcodeDetection').style.display = 'none';
    }

    extractISBN(text) {
        const cleaned = text.replace(/[-\s]/g, '');
        
        // ISBN-13
        if (/^97[89]\d{10}$/.test(cleaned)) {
            return cleaned;
        }
        
        // ISBN-10
        if (/^\d{9}[\dX]$/.test(cleaned)) {
            return this.convertISBN10to13(cleaned);
        }
        
        // EAN-13
        if (/^\d{13}$/.test(cleaned) && (cleaned.startsWith('978') || cleaned.startsWith('979'))) {
            return cleaned;
        }
        
        return null;
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