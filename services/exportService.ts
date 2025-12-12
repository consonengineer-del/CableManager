import { CutLogEntry, CutLogSummary } from '../types.ts';

declare const XLSX: any;

export const getTimestampedFileName = (): string => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const time = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    return `nhat_ky_cat_cap_${date}_${time}.xlsx`;
};

const createWorksheet = (logEntries: CutLogEntry[], summary: CutLogSummary) => {
    // Sort entries by Reel ID then by Start Index for grouping
    const sortedEntries = [...logEntries].sort((a, b) => {
        if (a.reelId !== b.reelId) {
            return a.reelId - b.reelId;
        }
        return a.startIndex - b.startIndex;
    });

    // Summary data as Array of Arrays
    const summaryAOA = [
        ["Báo Cáo Cắt Cáp"],
        [], // Spacer
        ["Tổng hợp:"],
        ["Tổng số sợi đã cắt", summary.totalCuts],
        ["Tổng chiều dài đã cắt (m)", summary.totalLength.toFixed(1)],
    ];
    
    // Create worksheet from summary
    const worksheet = XLSX.utils.aoa_to_sheet(summaryAOA);

    // Data for the main table - Columns reordered for better grouping visibility
    const dataToExport = sortedEntries.map(entry => ({
        'Cắt Từ Cuộn #': entry.reelId,
        'Tên Cáp': entry.name,
        'Chiều Dài (m)': entry.length,
        'Index Bắt Đầu (m)': entry.startIndex.toFixed(1),
        'Index Kết Thúc (m)': entry.endIndex.toFixed(1),
        'Thời Gian Thực Hiện': entry.timestamp ? new Date(entry.timestamp).toLocaleString('vi-VN') : 'N/A',
        'ID Lượt Cắt': entry.id,
    }));
    
    // Add the main data table below the summary, starting at row 7 (index 6)
    XLSX.utils.sheet_add_json(worksheet, dataToExport, { origin: 'A7' });
    
    // Merging
    worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // Merge title
        { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } }, // Merge "Tổng hợp:"
    ];

    worksheet['!cols'] = [
        { wch: 15 }, // Cắt Từ Cuộn #
        { wch: 30 }, // Tên Cáp
        { wch: 15 }, // Chiều Dài (m)
        { wch: 20 }, // Index Bắt Đầu (m)
        { wch: 20 }, // Index Kết Thúc (m)
        { wch: 25 }, // Thời Gian Thực Hiện
        { wch: 30 }, // ID Lượt Cắt
    ];

    return worksheet;
};

export const generateExcelBlob = (logEntries: CutLogEntry[], summary: CutLogSummary): Blob | null => {
    if (typeof XLSX === 'undefined') {
        console.error("XLSX library is not loaded.");
        return null;
    }

    const worksheet = createWorksheet(logEntries, summary);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Nhật ký cắt');

    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    
    return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};


export const exportToExcel = (logEntries: CutLogEntry[], summary: CutLogSummary): void => {
  if (logEntries.length === 0) {
      alert("Không có dữ liệu để xuất.");
      return;
  }
  
  const blob = generateExcelBlob(logEntries, summary);
  if (!blob) {
      alert("Chức năng xuất Excel không khả dụng do lỗi thư viện.");
      return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = getTimestampedFileName();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};