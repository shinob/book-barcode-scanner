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
            
            // デバイス列挙をサポートしていない場合は、デフォルトカメラを使用
            try {
                const videoInputDevices = await this.codeReader.listVideoInputDevices();
                
                if (videoInputDevices.length === 0) {
                    throw new Error('カメラデバイスが見つかりません');
                }

                // 利用可能な最初のカメラデバイスを使用
                const selectedDeviceId = videoInputDevices[0].deviceId;
                
                this.codeReader.decodeFromVideoDevice(selectedDeviceId, videoElement, (result, error) => {
                    this.handleScanResult(result, error);
                });
                
            } catch (enumerationError) {
                console.warn('デバイス列挙に失敗、デフォルトカメラを使用:', enumerationError.message);
                
                // デバイス列挙が失敗した場合、デフォルトカメラ（undefined）を使用
                this.codeReader.decodeFromVideoDevice(undefined, videoElement, (result, error) => {
                    this.handleScanResult(result, error);
                });
            }

        } catch (error) {
            this.isScanning = false;
            throw error;
        }
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
        const videoElement = document.getElementById('video');
        if (videoElement.srcObject) {
            const stream = videoElement.srcObject;
            stream.getTracks().forEach(track => track.stop());
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