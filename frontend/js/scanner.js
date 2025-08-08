export class BarcodeScanner {
    constructor() {
        this.codeReader = null;
        this.stream = null;
        this.isScanning = false;
        
        this.onScanSuccess = null;
        this.onScanError = null;
    }

    async startScanning() {
        try {
            // ZXing-jsのBrowserMultiFormatReaderを初期化
            this.codeReader = new ZXing.BrowserMultiFormatReader();
            
            const videoElement = document.getElementById('video');
            
            // スキャン開始
            this.isScanning = true;
            
            // Safari互換のためのMediaStream取得
            try {
                const stream = await this.getMediaStream();
                
                if (stream) {
                    this.stream = stream;
                    videoElement.srcObject = stream;
                    
                    // ビデオが準備完了するのを待つ
                    await new Promise((resolve) => {
                        videoElement.onloadedmetadata = () => {
                            videoElement.play();
                            resolve();
                        };
                    });
                    
                    // ZXingでスキャン開始
                    this.codeReader.decodeFromVideoDevice(undefined, videoElement, (result, error) => {
                        this.handleScanResult(result, error);
                    });
                } else {
                    throw new Error('MediaStreamの取得に失敗しました');
                }
                
            } catch (mediaError) {
                console.warn('MediaStreamの取得に失敗、ZXingの標準方法を使用:', mediaError.message);
                
                // フォールバック: ZXingの標準方法を使用
                this.codeReader.decodeFromVideoDevice(undefined, videoElement, (result, error) => {
                    this.handleScanResult(result, error);
                });
            }

        } catch (error) {
            this.isScanning = false;
            throw error;
        }
    }

    async getMediaStream() {
        // HTTPSチェック（本番環境でのみ）
        if (location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            throw new Error('カメラアクセスにはHTTPS接続が必要です');
        }

        const constraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'environment' // リアカメラを優先
            }
        };

        // モダンブラウザ対応
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                return await navigator.mediaDevices.getUserMedia(constraints);
            } catch (error) {
                console.warn('モダンAPI失敗、フォールバックを試行:', error.message);
                
                // facingModeがサポートされていない場合のフォールバック
                const fallbackConstraints = { video: true };
                return await navigator.mediaDevices.getUserMedia(fallbackConstraints);
            }
        }
        
        // Safari/古いブラウザ対応
        const getUserMedia = navigator.getUserMedia || 
                           navigator.webkitGetUserMedia || 
                           navigator.mozGetUserMedia || 
                           navigator.msGetUserMedia;
        
        if (getUserMedia) {
            return new Promise((resolve, reject) => {
                // 古いAPIはfacingModeをサポートしていない場合があるので、シンプルなconstraintsを使用
                const legacyConstraints = { video: true };
                getUserMedia.call(navigator, legacyConstraints, resolve, reject);
            });
        }
        
        throw new Error('このブラウザではカメラアクセスがサポートされていません');
    }
    
    handleScanResult(result, error) {
        if (result && this.isScanning) {
            const isbn = this.extractISBN(result.getText());
            if (isbn && this.onScanSuccess) {
                this.onScanSuccess(isbn);
            }
        }
        
        if (error && this.onScanError) {
            // ZXingのNotFoundExceptionは正常な動作（バーコードが見つからない）
            if (!error.name || error.name !== 'NotFoundException') {
                this.onScanError(error);
            }
        }
    }

    stopScanning() {
        this.isScanning = false;
        
        if (this.codeReader) {
            this.codeReader.reset();
            this.codeReader = null;
        }

        // ビデオストリームを停止
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
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