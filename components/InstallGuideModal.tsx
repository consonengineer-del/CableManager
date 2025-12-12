import React, { useState } from 'react';
import { XMarkIcon, IosShareIcon, AndroidMenuIcon, ShareIcon } from './icons.tsx';
import { PUBLIC_APP_URL } from '../config.ts';

interface InstallGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const InstallGuideModal: React.FC<InstallGuideModalProps> = ({ isOpen, onClose }) => {
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleShare = async () => {
        // 1. Ưu tiên lấy URL từ file config (PUBLIC_APP_URL)
        // 2. Nếu không có, lấy URL hiện tại nhưng loại bỏ query params (phần sau dấu ?) 
        //    để tránh chia sẻ các token phiên làm việc tạm thời.
        let urlToShare = PUBLIC_APP_URL;
        
        if (!urlToShare || urlToShare.trim() === '') {
            urlToShare = window.location.origin + window.location.pathname;
        }

        const title = "CableCalc - Công cụ tính cáp";
        
        // Ưu tiên sử dụng tính năng Chia sẻ của trình duyệt (Mobile)
        if (navigator.share) {
            try {
                await navigator.share({
                    title: title,
                    text: 'Công cụ lập kế hoạch cắt cáp tối ưu',
                    url: urlToShare,
                });
            } catch (err) {
                // User cancelled share, do nothing
            }
        } else {
            // Fallback: Copy to clipboard
            try {
                await navigator.clipboard.writeText(urlToShare);
                setCopyFeedback("Đã sao chép Link!");
                setTimeout(() => setCopyFeedback(null), 2000);
            } catch (err) {
                setCopyFeedback("Lỗi sao chép");
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
            <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-600 w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
                    <h2 className="text-xl font-bold text-cyan-400">Hướng dẫn Cài đặt & Sử dụng Offline</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-8 text-slate-300">
                    <div className="bg-cyan-900/20 p-4 rounded-lg border border-cyan-800/50">
                        <p className="text-sm">
                            Ứng dụng này được thiết kế theo chuẩn <strong>PWA (Progressive Web App)</strong>. 
                            Bạn có thể cài đặt nó trực tiếp từ trình duyệt mà không cần qua App Store hay CH Play để sử dụng ngay cả khi không có mạng.
                        </p>
                    </div>

                    {/* iOS Section */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <span className="bg-slate-700 p-1.5 rounded-md">📱</span> iPhone / iPad (iOS)
                        </h3>
                        <div className="ml-2 mb-2">
                             <button 
                                onClick={handleShare}
                                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-cyan-400 px-3 py-1.5 rounded text-sm font-medium transition-colors border border-slate-600"
                            >
                                <ShareIcon className="h-4 w-4" />
                                {copyFeedback || "Chia sẻ / Sao chép Link Ứng dụng"}
                            </button>
                        </div>
                        <ol className="list-decimal list-inside space-y-2 text-sm ml-2">
                            <li>Truy cập link trên bằng trình duyệt <strong>Safari</strong> (Bắt buộc).</li>
                            <li>
                                Nhấn vào nút <strong>Chia sẻ (Share)</strong> 
                                <span className="inline-block align-middle mx-1 bg-slate-700 p-1 rounded"><IosShareIcon className="h-4 w-4 inline" /></span>
                                ở thanh công cụ dưới cùng.
                            </li>
                            <li>Cuộn xuống và chọn <strong>"Thêm vào Màn hình chính" (Add to Home Screen)</strong>.</li>
                            <li>Nhấn <strong>"Thêm" (Add)</strong> ở góc trên bên phải.</li>
                        </ol>
                    </div>

                    {/* Android Section */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <span className="bg-slate-700 p-1.5 rounded-md">🤖</span> Android
                        </h3>
                         <div className="ml-2 mb-2">
                             <button 
                                onClick={handleShare}
                                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-cyan-400 px-3 py-1.5 rounded text-sm font-medium transition-colors border border-slate-600"
                            >
                                <ShareIcon className="h-4 w-4" />
                                {copyFeedback || "Chia sẻ / Sao chép Link Ứng dụng"}
                            </button>
                        </div>
                        <ol className="list-decimal list-inside space-y-2 text-sm ml-2">
                            <li>Mở link trên bằng trình duyệt <strong>Google Chrome</strong>.</li>
                            <li>
                                Nhấn vào nút <strong>Menu (3 chấm dọc)</strong>
                                <span className="inline-block align-middle mx-1 bg-slate-700 p-1 rounded"><AndroidMenuIcon className="h-4 w-4 inline" /></span>
                                ở góc trên bên phải.
                            </li>
                            <li>Chọn <strong>"Cài đặt ứng dụng" (Install App)</strong> hoặc <strong>"Thêm vào màn hình chính"</strong>.</li>
                            <li>Xác nhận cài đặt khi được hỏi.</li>
                        </ol>
                    </div>

                    {/* Desktop Section */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <span className="bg-slate-700 p-1.5 rounded-md">💻</span> Máy tính (PC/Laptop)
                        </h3>
                        <ol className="list-decimal list-inside space-y-2 text-sm ml-2">
                            <li>Sử dụng trình duyệt <strong>Chrome</strong> hoặc <strong>Edge</strong>.</li>
                            <li>Nhìn lên thanh địa chỉ (nơi nhập tên miền), phía bên phải sẽ có biểu tượng <strong>Cài đặt (Install)</strong> hình máy tính hoặc dấu cộng.</li>
                            <li>Nhấn vào đó và chọn <strong>Cài đặt</strong>.</li>
                            
                            <li className="pt-2 border-t border-slate-700 mt-2 font-bold text-cyan-400">Cách chạy chương trình Offline:</li>
                            <ul className="list-disc list-inside pl-4 space-y-1 text-slate-400 font-normal">
                                <li>
                                    Sau khi cài đặt, ứng dụng <strong>không tải về file</strong> (như .exe) mà sẽ tạo một biểu tượng <strong>"CableCalc"</strong> ngay trên màn hình <strong>Desktop</strong> của bạn.
                                </li>
                                <li>
                                    Bạn cũng có thể tìm thấy nó trong <strong>Start Menu</strong> (Windows) hoặc <strong>Applications</strong> (macOS).
                                </li>
                                <li>
                                    Để chạy Offline: Chỉ cần <strong>nhấn đúp vào biểu tượng đó</strong>. Ứng dụng sẽ mở ra như một phần mềm độc lập, không cần mở trình duyệt và không cần mạng internet.
                                </li>
                            </ul>
                        </ol>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-700 bg-slate-800/50 text-center">
                    <button 
                        onClick={onClose}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-6 rounded-md transition duration-300"
                    >
                        Đã hiểu
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InstallGuideModal;