// =====================================================================================
// !! BẮT BUỘC CẤU HÌNH !! - REQUIRED CONFIGURATION
// =====================================================================================
//
// Để sử dụng tính năng "Lưu vào Google Drive", bạn cần tạo một Client ID từ Google Cloud Console.
// To use the "Save to Google Drive" feature, you must create a Client ID from the Google Cloud Console.
//
// Hướng dẫn (Instructions):
// 1. Truy cập (Go to): https://console.cloud.google.com/apis/credentials
// 2. Nhấn "+ CREATE CREDENTIALS" và chọn "OAuth client ID".
//    (Click "+ CREATE CREDENTIALS" and select "OAuth client ID".)
// 3. Chọn "Application type" là "Web application".
//    (Choose "Application type" as "Web application".)
// 4. Trong "Authorized JavaScript origins", thêm URL của ứng dụng này.
//    (In "Authorized JavaScript origins", add the URL of this application.)
// 5. Sao chép "Client ID" được tạo và dán vào bên dưới.
//    (Copy the generated "Client ID" and paste it below.)
//
// =====================================================================================

export const GOOGLE_CLIENT_ID = 'cablecalculator.apps.googleusercontent.com';

// Phạm vi này cho phép ứng dụng tạo file mới trong Google Drive của bạn.
// Nó KHÔNG cho phép ứng dụng đọc, sửa, hay xóa các file khác.
// This scope allows the app to create new files in your Google Drive.
// It does NOT grant permission to read, modify, or delete any other files.
export const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

// =====================================================================================
// !! CẤU HÌNH CHIA SẺ (QUAN TRỌNG) !! - SHARE CONFIGURATION
// =====================================================================================
// Điền đường dẫn trang web sau khi bạn đã Publish (Deploy) lên Vercel/Netlify/GitHub Pages.
// Nếu để trống, ứng dụng sẽ lấy đường dẫn trên thanh địa chỉ trình duyệt (có thể bị lỗi nếu là link Preview).
// Ví dụ: 'https://cable-manager.vercel.app'
export const PUBLIC_APP_URL = ''; 