export class ExportManager {
    constructor() {
        // SheetJS (xlsx) ライブラリがCDNから読み込まれることを前提
    }

    exportToExcel(books) {
        try {
            if (!window.XLSX) {
                throw new Error('SheetJSライブラリが読み込まれていません');
            }

            const data = this.prepareDataForExport(books);
            
            // ワークブックとワークシートを作成
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data);

            // 列の幅を調整
            ws['!cols'] = [
                { width: 50 }, // タイトル
                { width: 30 }, // 著者
                { width: 20 }, // 出版社
                { width: 15 }, // 出版日
                { width: 15 }, // 定価
                { width: 15 }, // Amazon中古価格
                { width: 15 }, // 価格差
                { width: 20 }, // ISBN
                { width: 20 }, // 追加日時
            ];

            XLSX.utils.book_append_sheet(wb, ws, '書籍リスト');

            // ファイル名を生成（日時付き）
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `書籍リスト_${timestamp}.xlsx`;

            // ファイルをダウンロード
            XLSX.writeFile(wb, filename);

        } catch (error) {
            console.error('Excel export failed:', error);
            alert(`Excelエクスポートに失敗しました: ${error.message}`);
        }
    }

    exportToCSV(books) {
        try {
            const data = this.prepareDataForExport(books);
            
            if (data.length === 0) {
                alert('エクスポートするデータがありません');
                return;
            }

            // CSVヘッダー
            const headers = Object.keys(data[0]);
            
            // CSVデータを構築
            const csvContent = [
                // ヘッダー行
                headers.join(','),
                // データ行
                ...data.map(row => 
                    headers.map(header => this.escapeCsvValue(row[header])).join(',')
                )
            ].join('\n');

            // BOM付きUTF-8でエンコード（Excelで文字化けを防ぐ）
            const bom = '\uFEFF';
            const blob = new Blob([bom + csvContent], { 
                type: 'text/csv;charset=utf-8;' 
            });

            // ファイル名を生成（日時付き）
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `書籍リスト_${timestamp}.csv`;

            // ダウンロードリンクを作成してクリック
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // オブジェクトURLを解放
            URL.revokeObjectURL(link.href);

        } catch (error) {
            console.error('CSV export failed:', error);
            alert(`CSVエクスポートに失敗しました: ${error.message}`);
        }
    }

    prepareDataForExport(books) {
        return books.map(book => ({
            'タイトル': book.title || '',
            '著者': Array.isArray(book.authors) ? book.authors.join(', ') : (book.authors || ''),
            '出版社': book.publisher || '',
            '出版日': book.publishedDate || '',
            '定価': book.listPrice ? `¥${book.listPrice.toLocaleString()}` : '',
            'Amazon中古価格': book.amazonPrice ? `¥${book.amazonPrice.toLocaleString()}` : '',
            '価格差': this.calculateAndFormatPriceDifference(book.listPrice, book.amazonPrice),
            'ISBN': book.isbn || '',
            '追加日時': this.formatAddedDate(book.addedAt)
        }));
    }

    calculateAndFormatPriceDifference(listPrice, amazonPrice) {
        if (!listPrice || !amazonPrice) return '';
        
        const diff = listPrice - amazonPrice;
        if (diff === 0) return '¥0';
        
        const sign = diff > 0 ? '+' : '';
        return `${sign}¥${diff.toLocaleString()}`;
    }

    formatAddedDate(isoDateString) {
        if (!isoDateString) return '';
        
        try {
            const date = new Date(isoDateString);
            return date.toLocaleDateString('ja-JP') + ' ' + 
                   date.toLocaleTimeString('ja-JP', { 
                       hour: '2-digit', 
                       minute: '2-digit' 
                   });
        } catch (error) {
            console.warn('Date format error:', error);
            return isoDateString;
        }
    }

    escapeCsvValue(value) {
        if (value === null || value === undefined) {
            return '';
        }
        
        const stringValue = String(value);
        
        // ダブルクォート、カンマ、改行を含む場合はクォートで囲む
        if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
            // 内部のダブルクォートはエスケープ
            return '"' + stringValue.replace(/"/g, '""') + '"';
        }
        
        return stringValue;
    }

    // 統計情報を含む詳細エクスポート
    exportDetailedExcel(books) {
        try {
            if (!window.XLSX) {
                throw new Error('SheetJSライブラリが読み込まれていません');
            }

            const wb = XLSX.utils.book_new();
            
            // メインの書籍データシート
            const bookData = this.prepareDataForExport(books);
            const ws1 = XLSX.utils.json_to_sheet(bookData);
            ws1['!cols'] = [
                { width: 50 }, { width: 30 }, { width: 20 }, { width: 15 },
                { width: 15 }, { width: 15 }, { width: 15 }, { width: 20 }, { width: 20 }
            ];
            XLSX.utils.book_append_sheet(wb, ws1, '書籍リスト');

            // 統計情報シート
            const stats = this.generateStatistics(books);
            const ws2 = XLSX.utils.json_to_sheet(stats);
            ws2['!cols'] = [{ width: 30 }, { width: 20 }];
            XLSX.utils.book_append_sheet(wb, ws2, '統計情報');

            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `書籍リスト詳細_${timestamp}.xlsx`;

            XLSX.writeFile(wb, filename);

        } catch (error) {
            console.error('Detailed Excel export failed:', error);
            alert(`詳細Excelエクスポートに失敗しました: ${error.message}`);
        }
    }

    generateStatistics(books) {
        const totalBooks = books.length;
        const booksWithPrice = books.filter(book => book.listPrice).length;
        const booksWithAmazonPrice = books.filter(book => book.amazonPrice).length;
        
        const totalListPrice = books
            .filter(book => book.listPrice)
            .reduce((sum, book) => sum + book.listPrice, 0);
        
        const totalAmazonPrice = books
            .filter(book => book.amazonPrice)
            .reduce((sum, book) => sum + book.amazonPrice, 0);
        
        const avgListPrice = booksWithPrice > 0 ? totalListPrice / booksWithPrice : 0;
        const avgAmazonPrice = booksWithAmazonPrice > 0 ? totalAmazonPrice / booksWithAmazonPrice : 0;
        
        const profitableBooks = books.filter(book => 
            book.listPrice && book.amazonPrice && book.listPrice > book.amazonPrice
        ).length;

        return [
            { '項目': '総書籍数', '値': totalBooks },
            { '項目': '定価情報有り', '値': booksWithPrice },
            { '項目': 'Amazon価格情報有り', '値': booksWithAmazonPrice },
            { '項目': '定価合計', '値': `¥${totalListPrice.toLocaleString()}` },
            { '項目': 'Amazon中古価格合計', '値': `¥${totalAmazonPrice.toLocaleString()}` },
            { '項目': '平均定価', '値': `¥${Math.round(avgListPrice).toLocaleString()}` },
            { '項目': '平均Amazon中古価格', '値': `¥${Math.round(avgAmazonPrice).toLocaleString()}` },
            { '項目': '利益の出る書籍数', '值': profitableBooks },
            { '項目': 'エクスポート日時', '値': new Date().toLocaleString('ja-JP') }
        ];
    }
}