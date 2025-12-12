import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ReelState, CutRequest, AllocationResult, ParsedReel, ParsedCut, Allocation, AllocatedCut, CutLogEntry, CutLogSummary } from './types.ts';
import { CutIcon, LightBulbIcon, TrashIcon, InformationCircleIcon } from './components/icons.tsx';
import { exportToExcel, generateExcelBlob, getTimestampedFileName } from './services/exportService.ts';
import { GOOGLE_CLIENT_ID, GOOGLE_DRIVE_SCOPE } from './config.ts';
import InstallGuideModal from './components/InstallGuideModal.tsx';

const MAX_REEL_LENGTH = 305;

const App: React.FC = () => {
  // --- STATE MANAGEMENT with localStorage persistence ---
  
  const [reels, setReels] = useState<ReelState[]>(() => {
    try {
      const saved = localStorage.getItem('cablePlannerReels');
      return (saved && JSON.parse(saved).length > 0) ? JSON.parse(saved) : [{ id: 1, length: '' }];
    } catch (e) {
      console.error("Failed to load reels from localStorage", e);
      return [{ id: 1, length: '' }];
    }
  });

  const [cuts, setCuts] = useState<CutRequest[]>(() => {
    try {
      const saved = localStorage.getItem('cablePlannerCuts');
      return (saved && JSON.parse(saved).length > 0) ? JSON.parse(saved) : [{ id: 1, name: 'Sợi #1', length: '' }];
    } catch (e) {
      console.error("Failed to load cuts from localStorage", e);
      return [{ id: 1, name: 'Sợi #1', length: '' }];
    }
  });
  
  const [cutLog, setCutLog] = useState<CutLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('cablePlannerCutLog');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load cut log from localStorage", e);
      return [];
    }
  });

  // New state for Design Notes
  const [designNotes, setDesignNotes] = useState<string>(() => {
    return localStorage.getItem('cablePlannerDesignNotes') || '';
  });

  // New state for Calculation Mode
  const [calcMode, setCalcMode] = useState<'standard' | 'strict'>('standard');
  const [strictLimit, setStrictLimit] = useState<number>(10);

  const [numReels, setNumReels] = useState<string>(String(reels.length));
  const [numCuts, setNumCuts] = useState<string>(String(cuts.length));
  
  const [result, setResult] = useState<AllocationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Offline & Google Drive Integration State ---
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isGapiReady, setIsGapiReady] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  
  // State for Install Guide Modal
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  // Handle Online/Offline Status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Effect to save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('cablePlannerReels', JSON.stringify(reels));
  }, [reels]);

  useEffect(() => {
    localStorage.setItem('cablePlannerCuts', JSON.stringify(cuts));
  }, [cuts]);
  
  useEffect(() => {
    localStorage.setItem('cablePlannerCutLog', JSON.stringify(cutLog));
  }, [cutLog]);

  useEffect(() => {
    localStorage.setItem('cablePlannerDesignNotes', designNotes);
  }, [designNotes]);

  // --- Google API Initialization ---
  useEffect(() => {
    if (!isOnline) return; // Don't try to load Google API if offline

    if (GOOGLE_CLIENT_ID.startsWith('YOUR_GOOGLE_CLIENT_ID')) {
      setError("Lỗi Cấu Hình: Tính năng Google Drive chưa được kích hoạt. Vui lòng cấu hình Google Client ID trong file config.ts.");
      return; 
    }

    const initClient = () => {
      try {
        if (!window.gapi) {
            console.warn("Google API script not loaded yet.");
            return;
        }
        window.gapi.client.init({
          clientId: GOOGLE_CLIENT_ID,
          scope: GOOGLE_DRIVE_SCOPE,
          discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
        }).then(() => {
          setIsGapiReady(true);
          const authInstance = window.gapi.auth2.getAuthInstance();
          authInstance.isSignedIn.listen(setIsSignedIn);
          setIsSignedIn(authInstance.isSignedIn.get());
        }).catch((err: any) => {
          console.error("Error initializing Google API Client:", err);
        });
      } catch (e) {
          console.error("Exception in initClient:", e);
      }
    };

    const checkGapiLoaded = () => {
      if (window.gapi && window.gapi.load) {
        window.gapi.load('client:auth2', initClient);
      } else {
        setTimeout(checkGapiLoaded, 100); 
      }
    };

    checkGapiLoaded();
  }, [isOnline]); 


  const handleSignIn = () => {
      if (!isOnline) {
          alert("Vui lòng kết nối mạng để đăng nhập.");
          return;
      }
      if (!window.gapi || !window.gapi.auth2) {
          alert("Dịch vụ Google chưa sẵn sàng. Vui lòng thử lại sau giây lát.");
          return;
      }
      window.gapi.auth2.getAuthInstance().signIn();
  }

  const handleSignOut = () => {
      if (window.gapi && window.gapi.auth2) {
          window.gapi.auth2.getAuthInstance().signOut();
      }
  };

  const cutLogSummary: CutLogSummary = useMemo(() => {
    const totalCuts = cutLog.length;
    const totalLength = cutLog.reduce((sum, entry) => sum + entry.length, 0);
    return { totalCuts, totalLength };
  }, [cutLog]);

  // Calculate total requested length from inputs
  const totalRequestedLength = useMemo(() => {
    return cuts.reduce((sum, cut) => {
      const len = parseFloat(cut.length);
      return sum + (isNaN(len) ? 0 : len);
    }, 0);
  }, [cuts]);

  const handleExportToDrive = async () => {
    if (!isOnline) {
        alert("Bạn đang ngoại tuyến. Vui lòng kết nối internet để sử dụng tính năng này.");
        return;
    }
    if (cutLog.length === 0) {
        alert("Không có dữ liệu để xuất.");
        return;
    }
    
    setIsUploading(true);
    setUploadMessage("Đang tạo file Excel...");
    
    const blob = generateExcelBlob(cutLog, cutLogSummary);
    if (!blob) {
        alert("Không thể tạo file Excel.");
        setIsUploading(false);
        setUploadMessage(null);
        return;
    }

    const fileName = getTimestampedFileName();
    const metadata = {
        'name': fileName,
        'mimeType': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    setUploadMessage("Đang tải file lên Google Drive...");

    try {
        const res = await window.gapi.client.request({
            path: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            method: 'POST',
            headers: {
                Authorization: `Bearer ${window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token}`
            },
            body: form
        });
        
        console.log(res);
        setUploadMessage(`Thành công! Đã lưu file "${fileName}" vào Google Drive.`);
    } catch (err: any) {
        console.error("Error uploading to Google Drive", err);
        setUploadMessage(`Lỗi: Không thể tải file lên. ${err.result?.error?.message || ''}`);
    } finally {
        setIsUploading(false);
        setTimeout(() => setUploadMessage(null), 5000);
    }
  };


  const calculateIndexes = (lengthStr: string) => {
    const length = parseFloat(lengthStr);
    if (isNaN(length) || length <= 0 || length > MAX_REEL_LENGTH) {
      return { start: '??', end: '??' };
    }
    const start = MAX_REEL_LENGTH - length;
    return { start: start.toFixed(1), end: MAX_REEL_LENGTH.toFixed(1) };
  };

  const handleNumReelsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const count = parseInt(e.target.value, 10);
    setNumReels(e.target.value);
    if (count > 0 && count <= 20) {
      setReels(prev => Array.from({ length: count }, (_, i) => ({ id: i + 1, length: prev[i]?.length || '' })));
    } else if (e.target.value === '') {
        setReels([]);
    }
  };
  
  const handleReelLengthChange = (id: number, length: string) => {
    setReels(reels.map(reel => reel.id === id ? { ...reel, length } : reel));
  };
  
  const handleRemoveReel = (id: number) => {
    const newReels = reels.filter(reel => reel.id !== id);
    setReels(newReels);
    setNumReels(String(newReels.length));
  };

  const handleNumCutsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const count = parseInt(e.target.value, 10);
    setNumCuts(e.target.value);
    if (count > 0 && count <= 50) {
      setCuts(prev => Array.from({ length: count }, (_, i) => ({ id: i + 1, name: prev[i]?.name || `Sợi #${i + 1}`, length: prev[i]?.length || '' })));
    } else if (e.target.value === '') {
        setCuts([]);
    }
  };
  
  const handleCutChange = (id: number, field: 'name' | 'length', value: string) => {
    setCuts(cuts.map(cut => cut.id === id ? { ...cut, [field]: value } : cut));
  };

  const handleRemoveCut = (id: number) => {
    const newCuts = cuts.filter(cut => cut.id !== id);
    setCuts(newCuts);
    setNumCuts(String(newCuts.length));
  };

  const handleReelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index < reels.length - 1) {
        const nextReelId = reels[index + 1].id;
        const nextInput = document.getElementById(`reel-${nextReelId}`);
        if (nextInput) {
          nextInput.focus();
        }
      } else {
        const numCutsInput = document.getElementById('numCuts');
        if (numCutsInput) {
            numCutsInput.focus();
        }
      }
    }
  };

  const handleLengthKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextInput = document.getElementById(`cut-name-${index + 1}`);
      if (nextInput) {
        nextInput.focus();
      }
    }
  };
  
  const handleReset = () => {
    if (window.confirm("Bắt đầu một phiên làm việc mới? Toàn bộ dữ liệu nhập hiện tại sẽ được xóa. Nhật ký cắt sẽ được giữ lại.")) {
        const initialReels: ReelState[] = [{ id: 1, length: '' }];
        const initialCuts: CutRequest[] = [{ id: 1, name: 'Sợi #1', length: '' }];
        setReels(initialReels);
        setCuts(initialCuts);
        setNumReels(String(initialReels.length));
        setNumCuts(String(initialCuts.length));
        setResult(null);
        setError(null);
        localStorage.removeItem('cablePlannerReels');
        localStorage.removeItem('cablePlannerCuts');
    }
  };
  
  const handleClearLog = () => {
    if (window.confirm("Bạn có chắc muốn xóa toàn bộ nhật ký cắt? Hành động này không thể hoàn tác.")) {
        setCutLog([]);
        localStorage.removeItem('cablePlannerCutLog');
    }
  };

  const handleClearNotes = () => {
      if (window.confirm("Xóa toàn bộ nội dung ghi chú?")) {
          setDesignNotes('');
      }
  };

  const handleCalculate = () => {
    setError(null);
    setResult(null);

    const parsedCuts: ParsedCut[] = cuts.map(c => ({ id: c.id, name: c.name, length: parseFloat(c.length) })).filter(c => c.length > 0);
    const parsedReels: ReelState[] = reels.filter(r => r.length.trim() !== '');

    if (parsedReels.length === 0) return setError("Lỗi: Vui lòng khai báo ít nhất một cuộn cáp.");
    if (parsedCuts.length === 0) return setError("Lỗi: Vui lòng khai báo ít nhất một sợi cáp cần cắt.");
    if (parsedReels.some(r => { const len = parseFloat(r.length); return isNaN(len) || len <= 0 || len > MAX_REEL_LENGTH; }))
      return setError(`Lỗi: Vui lòng nhập chiều dài hợp lệ (lớn hơn 0 và không quá ${MAX_REEL_LENGTH}m) cho tất cả các cuộn cáp.`);
    if (parsedCuts.some(c => isNaN(c.length) || c.length <= 0))
      return setError('Lỗi: Vui lòng nhập chiều dài hợp lệ (lớn hơn 0) cho tất cả các sợi cáp cần cắt.');
    if (parsedCuts.some(c => c.name.trim() === ''))
      return setError('Lỗi: Vui lòng nhập tên cho tất cả các sợi cáp cần cắt.');
    
    const parsedReelsWithIndex: ParsedReel[] = parsedReels.map(r => {
        const length = parseFloat(r.length);
        return { id: r.id, length, startIndex: MAX_REEL_LENGTH - length, endIndex: MAX_REEL_LENGTH };
    });

    const tempReels = parsedReelsWithIndex.map(r => ({ ...r }));
    const allocation: Allocation = Object.fromEntries(tempReels.map(r => [r.id, { assignedCuts: [], remaining: r.length, newStartIndex: r.startIndex }]));
    const unallocatedCuts: ParsedCut[] = [];
    const sortedCuts = [...parsedCuts].sort((a, b) => b.length - a.length);

    sortedCuts.forEach(cut => {
      let bestFitReelId = -1;
      let minWaste = Infinity;
      tempReels.forEach(reel => {
        if (reel.length >= cut.length) {
          const waste = reel.length - cut.length;
          if (waste < minWaste) {
            minWaste = waste;
            bestFitReelId = reel.id;
          }
        }
      });
      
      if (bestFitReelId !== -1) {
        const targetReel = tempReels.find(r => r.id === bestFitReelId)!;
        const allocationDetail = allocation[bestFitReelId];
        const cutStartIndex = allocationDetail.newStartIndex;
        const cutEndIndex = cutStartIndex + cut.length;
        allocationDetail.assignedCuts.push({ ...cut, startIndex: cutStartIndex, endIndex: cutEndIndex });
        targetReel.length -= cut.length;
        allocationDetail.remaining = targetReel.length;
        allocationDetail.newStartIndex = cutEndIndex;
      } else {
        unallocatedCuts.push(cut);
      }
    });
    
    const warnings: string[] = [];
    if (calcMode === 'strict') {
        Object.keys(allocation).forEach(key => {
            const reelId = Number(key);
            const detail = allocation[reelId];
            if (detail.assignedCuts.length > 0) {
                if (detail.remaining > strictLimit) {
                    warnings.push(`Cuộn #${reelId} còn dư ${detail.remaining.toFixed(1)}m (Vượt quá mức ${strictLimit}m).`);
                }
            }
        });
    }

    const calculationResult: AllocationResult = { 
        success: unallocatedCuts.length === 0, 
        allocation, 
        unallocatedCuts, 
        reelsBefore: parsedReelsWithIndex,
        warnings: warnings.length > 0 ? warnings : undefined
    };
    
    setResult(calculationResult);
    
    if (calculationResult.success) {
      const timestamp = new Date().toISOString();
      const cutBatchId = `cut-run-${Date.now()}`;
      const newLogEntries = Object.values(calculationResult.allocation).flatMap(detail => 
        detail.assignedCuts.map(cut => ({
          id: `${cutBatchId}-${detail.assignedCuts[0].id}-${cut.id}`,
          name: cut.name,
          length: cut.length,
          reelId: tempReels.find(r => allocation[r.id] === detail)?.id || 0,
          startIndex: cut.startIndex,
          endIndex: cut.endIndex,
          timestamp: timestamp,
        }))
      );
      setCutLog(prevLog => [...prevLog, ...newLogEntries]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 sm:p-6 lg:p-8">
      {!isOnline && (
        <div className="fixed top-0 left-0 w-full bg-slate-700 text-slate-300 text-center py-1 text-xs z-50 shadow-md">
          Bạn đang sử dụng chế độ Offline. Các tính năng Google Drive sẽ tạm khóa.
        </div>
      )}

      <div className={`max-w-7xl mx-auto ${!isOnline ? 'mt-4' : ''}`}>
        <header className="mb-8 text-center relative">
          <div className="absolute top-0 right-0">
             <button 
                onClick={() => setShowInstallGuide(true)}
                className="flex items-center text-xs sm:text-sm text-cyan-500 hover:text-cyan-400 border border-cyan-800 bg-cyan-900/20 px-3 py-1.5 rounded-full transition-colors"
             >
                <InformationCircleIcon className="h-4 w-4 mr-1.5" />
                Hướng dẫn Cài đặt
             </button>
          </div>
          <h3 className="text-lg md:text-xl font-semibold text-slate-300 mb-2 uppercase tracking-wide mt-8 sm:mt-0">Công ty TNHH phát triển công nghệ và hạ tầng kỹ thuật Côn Sơn</h3>
          <h2 className="text-2xl font-bold text-yellow-400 mb-2 tracking-wider">Designer by: Nguyễn Hoàng Long</h2>
          <h1 className="text-4xl font-bold text-cyan-400">Công cụ lập kế hoạch cắt cáp</h1>
          <p className="text-slate-400 mt-2">Khai báo số lượng cuộn cáp cần và nhu cầu cần cắt để tìm ra phương án tối ưu và tiết kiệm nhất.</p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          
          <div className="space-y-8">
            <div className="bg-slate-800 p-6 rounded-lg shadow-lg">
              <h2 className="text-2xl font-semibold mb-4 border-b border-slate-600 pb-3">1. Khai báo Cuộn Cáp</h2>
              <div className="mb-4">
                <label htmlFor="numReels" className="block text-sm font-medium text-slate-300 mb-2">Bạn có bao nhiêu cuộn cáp?</label>
                <input id="numReels" type="number" min="1" max="20" value={numReels} onChange={handleNumReelsChange} className="block w-32 bg-slate-700 border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500" />
              </div>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {reels.map((reel, index) => (
                  <div key={reel.id} className="grid grid-cols-12 items-center gap-2">
                    <label htmlFor={`reel-${reel.id}`} className="font-medium text-slate-300 col-span-2">Cuộn #{reel.id}</label>
                    <input 
                      id={`reel-${reel.id}`} 
                      type="number" 
                      value={reel.length} 
                      onChange={e => handleReelLengthChange(reel.id, e.target.value)} 
                      onKeyDown={(e) => handleReelKeyDown(e, index)}
                      placeholder="Chiều dài (m)" 
                      className="col-span-4 bg-slate-700 border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500" 
                    />
                    <div className="col-span-5 text-sm text-slate-400 text-center">
                      {`(${calculateIndexes(reel.length).start}m → ${calculateIndexes(reel.length).end}m)`}
                    </div>
                     <button 
                      onClick={() => handleRemoveReel(reel.id)}
                      className="col-span-1 flex items-center justify-center text-slate-500 hover:text-red-500 transition-colors"
                      title="Xóa cuộn cáp này"
                      tabIndex={-1}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-700">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Chế độ tính toán & Tiêu chuẩn dư:</h3>
                <div className="flex flex-col space-y-3">
                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="calcMode" 
                      checked={calcMode === 'standard'} 
                      onChange={() => setCalcMode('standard')}
                      className="form-radio h-4 w-4 text-cyan-600 border-slate-500 bg-slate-700 focus:ring-cyan-500 focus:ring-offset-slate-800"
                    />
                    <span className="text-slate-300 group-hover:text-white transition-colors">Tối ưu tổng thể (Giảm thiểu vụn tối đa)</span>
                  </label>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <label className="flex items-center space-x-3 cursor-pointer group">
                        <input 
                          type="radio" 
                          name="calcMode" 
                          checked={calcMode === 'strict'} 
                          onChange={() => setCalcMode('strict')}
                          className="form-radio h-4 w-4 text-cyan-600 border-slate-500 bg-slate-700 focus:ring-cyan-500 focus:ring-offset-slate-800"
                        />
                        <span className="text-slate-300 group-hover:text-white transition-colors">Ưu tiên sạch cuộn</span>
                      </label>
                      
                      {calcMode === 'strict' && (
                          <div className="ml-7 sm:ml-0 flex items-center bg-slate-700 rounded px-2 py-1 border border-slate-600 animate-fadeIn">
                              <span className="text-xs text-slate-400 mr-2">Dư tối đa:</span>
                              <select 
                                  value={strictLimit} 
                                  onChange={(e) => setStrictLimit(Number(e.target.value))}
                                  className="bg-transparent text-sm text-cyan-400 font-bold focus:outline-none cursor-pointer"
                              >
                                  <option value={5}>&lt; 5m</option>
                                  <option value={10}>&lt; 10m</option>
                              </select>
                          </div>
                      )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 p-6 rounded-lg shadow-lg">
              <h2 className="text-2xl font-semibold mb-4 border-b border-slate-600 pb-3">2. Khai báo Nhu Cầu Cắt</h2>
               <div className="mb-4 flex flex-wrap justify-between items-end gap-4">
                <div>
                  <label htmlFor="numCuts" className="block text-sm font-medium text-slate-300 mb-2">Bạn cần cắt bao nhiêu sợi cáp?</label>
                  <input id="numCuts" type="number" min="1" max="50" value={numCuts} onChange={handleNumCutsChange} className="block w-32 bg-slate-700 border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500" />
                </div>
                <div className="bg-slate-900/50 p-2 px-4 rounded border border-slate-700 flex flex-col items-end justify-center">
                    <span className="text-xs text-slate-400 uppercase tracking-wide">Tổng chiều dài cần cắt</span>
                    <span className="text-xl font-bold text-cyan-400">{totalRequestedLength.toFixed(1)}m</span>
                </div>
              </div>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                {cuts.map((cut, index) => (
                  <div key={cut.id} className="grid grid-cols-12 items-center gap-2 p-2 rounded-md border border-slate-700 group">
                    <input 
                      id={`cut-name-${index}`}
                      type="text" 
                      value={cut.name} 
                      onChange={e => handleCutChange(cut.id, 'name', e.target.value)} 
                      placeholder="Tên / ID sợi cáp" 
                      className="col-span-6 bg-slate-900/50 border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500" 
                    />
                    <input 
                      type="number" 
                      value={cut.length} 
                      onChange={e => handleCutChange(cut.id, 'length', e.target.value)}
                      onKeyDown={(e) => handleLengthKeyDown(e, index)}
                      placeholder="Dài (m)" 
                      className="col-span-5 bg-slate-900/50 border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500" 
                    />
                    <button 
                      onClick={() => handleRemoveCut(cut.id)}
                      className="col-span-1 flex items-center justify-center text-slate-500 hover:text-red-500 transition-colors"
                      title="Xóa sợi cáp này"
                      tabIndex={-1}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex w-full items-stretch gap-4">
              <button onClick={handleCalculate} className="flex-grow flex items-center justify-center bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded-md transition duration-300 transform hover:scale-105 text-lg">
                <CutIcon /> Tính toán & Phân bổ
              </button>
              <button onClick={handleReset} title="Xóa toàn bộ dữ liệu đã nhập để bắt đầu phiên mới" className="flex-shrink-0 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-4 rounded-md transition duration-300">
                Phiên Mới
              </button>
            </div>

            {error && (
              <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-md" role="alert">
                <p className="font-bold">{error}</p>
              </div>
            )}
          </div>
          
          <div className="bg-slate-800 p-6 rounded-lg shadow-lg">
             <h2 className="text-2xl font-semibold mb-4 border-b border-slate-600 pb-3">Kết quả Phân bổ</h2>
             {!result && (
                <div className="flex items-center justify-center h-full">
                    <p className="text-slate-400">Nhập thông tin và nhấn nút tính toán để xem kết quả tại đây.</p>
                </div>
             )}

             {result?.success && (
                <div className="space-y-6">
                    <div className="bg-green-900/50 border border-green-700 text-green-200 px-4 py-3 rounded-md">
                        <h3 className="font-bold text-lg">Thành công!</h3>
                        <p>Tất cả các sợi cáp đều có thể được cắt. Dưới đây là kế hoạch đề xuất. Nhật ký cắt đã được cập nhật.</p>
                    </div>

                    {result.warnings && result.warnings.length > 0 && (
                        <div className="bg-orange-900/50 border border-orange-700 text-orange-200 px-4 py-3 rounded-md animate-pulse">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                Cảnh báo chế độ Sạch Cuộn:
                            </h3>
                            <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                                {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                        </div>
                    )}

                    <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
                        {result.reelsBefore.map(reelBefore => {
                            const remaining = result.allocation[reelBefore.id].remaining;
                            const isStrictViolation = calcMode === 'strict' && remaining > strictLimit && result.allocation[reelBefore.id].assignedCuts.length > 0;

                            return (
                                <div key={reelBefore.id} className={`bg-slate-900/70 p-4 rounded-lg border ${isStrictViolation ? 'border-orange-500/50 shadow-[0_0_10px_rgba(249,115,22,0.2)]' : 'border-slate-700'}`}>
                                    <h4 className="font-bold text-lg text-cyan-400 flex justify-between">
                                        Cuộn #{reelBefore.id}
                                        {isStrictViolation && <span className="text-xs bg-orange-600 text-white px-2 py-1 rounded">Dư nhiều</span>}
                                    </h4>
                                    <p className="text-sm text-slate-400 mb-2">
                                        Ban đầu: {reelBefore.length.toFixed(1)}m <span className="text-xs">({reelBefore.startIndex.toFixed(1)}m → {reelBefore.endIndex.toFixed(1)}m)</span>
                                        <span className="mx-2">→</span>
                                        Còn lại: <span className={`font-bold ${isStrictViolation ? 'text-orange-400' : 'text-green-400'}`}>
                                            {remaining.toFixed(1)}m
                                        </span>
                                        <span className="text-xs ml-1">({result.allocation[reelBefore.id].newStartIndex.toFixed(1)}m → {reelBefore.endIndex.toFixed(1)}m)</span>
                                    </p>
                                    <ul className="list-disc list-inside space-y-1 pl-2 text-slate-300">
                                      {result.allocation[reelBefore.id].assignedCuts.length > 0 ? (
                                        result.allocation[reelBefore.id].assignedCuts.map(cut => (
                                          <li key={cut.id}>
                                              <span className="font-medium text-white">{cut.name}</span> - <span className="text-cyan-300">{cut.length}m</span>
                                              <span className="text-xs text-slate-400 ml-2">({cut.startIndex.toFixed(1)}m → {cut.endIndex.toFixed(1)}m)</span>
                                          </li>
                                        ))
                                      ) : ( <p className="text-slate-500 italic">Không cắt sợi nào từ cuộn này.</p> )}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                </div>
             )}

            {result && !result.success && (
                 <div className="space-y-6">
                    <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-md">
                        <h3 className="font-bold text-lg">Không Khả Thi!</h3>
                        <p>Không đủ cáp để thực hiện tất cả các lượt cắt. Chi tiết:</p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-lg text-red-400 mb-2">Các sợi không thể cắt:</h4>
                         <ul className="list-disc list-inside space-y-1 pl-2 text-slate-300">
                            {result.unallocatedCuts.map(cut => ( <li key={cut.id}> <span className="font-medium text-white">{cut.name}</span> - Cần <span className="text-red-400 font-bold">{cut.length}m</span> </li> ))}
                        </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg text-yellow-400 mb-2">Phân bổ các sợi khả thi:</h4>
                      <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                        {result.reelsBefore.map(reelBefore => {
                           const allocationDetail = result.allocation[reelBefore.id];
                           if (allocationDetail.assignedCuts.length === 0) return null;
                           return (
                              <div key={reelBefore.id} className="bg-slate-900/70 p-4 rounded-lg border border-slate-700">
                                  <h4 className="font-bold text-lg text-cyan-400">Cuộn #{reelBefore.id}</h4>
                                  <p className="text-sm text-slate-400 mb-2">
                                      Ban đầu: {reelBefore.length.toFixed(1)}m <span className="text-xs">({reelBefore.startIndex.toFixed(1)}m → {reelBefore.endIndex.toFixed(1)}m)</span>
                                      <span className="mx-2">→</span>
                                      Còn lại: <span className="font-bold text-green-400">{allocationDetail.remaining.toFixed(1)}m <span className="text-xs">({allocationDetail.newStartIndex.toFixed(1)}m → {reelBefore.endIndex.toFixed(1)}m)</span></span>
                                  </p>
                                  <ul className="list-disc list-inside space-y-1 pl-2 text-slate-300">
                                    {allocationDetail.assignedCuts.map(cut => (
                                      <li key={cut.id}>
                                          <span className="font-medium text-white">{cut.name}</span> - <span className="text-cyan-300">{cut.length}m</span>
                                          <span className="text-xs text-slate-400 ml-2">({cut.startIndex.toFixed(1)}m → {cut.endIndex.toFixed(1)}m)</span>
                                      </li>
                                    ))}
                                  </ul>
                              </div>
                           );
                        })}
                      </div>
                    </div>
                </div>
            )}
          </div>
        </main>
        
        <section className="bg-slate-800 p-6 rounded-lg shadow-lg mb-8">
            <div className="flex flex-wrap justify-between items-center mb-4 border-b border-slate-600 pb-3">
                <div className="flex items-center">
                    <LightBulbIcon />
                    <h2 className="text-2xl font-semibold">Ghi chú & Ý tưởng Thiết kế</h2>
                </div>
                {designNotes && (
                    <button onClick={handleClearNotes} className="text-sm text-red-400 hover:text-red-300 underline">
                        Xóa ghi chú
                    </button>
                )}
            </div>
            <p className="text-slate-400 mb-4 text-sm">
                Không gian để bạn nháp ý tưởng, ghi lại sơ đồ đấu nối, hoặc lưu ý kỹ thuật cho dự án này.
                Dữ liệu được tự động lưu trên trình duyệt của bạn.
            </p>
            <textarea
                value={designNotes}
                onChange={(e) => setDesignNotes(e.target.value)}
                className="w-full h-48 bg-slate-900/70 border border-slate-600 rounded-lg p-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono leading-relaxed"
                placeholder="- Tầng 1: 5 dây (P1->P5)...&#10;- Lưu ý: Tránh đi dây qua khu vực nhiệt độ cao..."
            />
        </section>

        <section className="bg-slate-800 p-6 rounded-lg shadow-lg">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-4 border-b border-slate-600 pb-3">
                <h2 className="text-2xl font-semibold">Nhật ký cắt</h2>
                <div className="flex flex-wrap gap-2 items-center">
                    <button onClick={() => exportToExcel(cutLog, cutLogSummary)} disabled={cutLog.length === 0} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-md transition duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed text-sm">Xuất Excel</button>
                    {!isSignedIn && isGapiReady && (
                       <button onClick={handleSignIn} disabled={!isOnline} className={`font-bold py-2 px-3 rounded-md transition duration-300 text-sm ${!isOnline ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                          {isOnline ? 'Đăng nhập Google' : 'Cần Internet'}
                       </button>
                    )}
                    {isSignedIn && (
                      <>
                        <button onClick={handleExportToDrive} disabled={cutLog.length === 0 || isUploading || !isOnline} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-3 rounded-md transition duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed text-sm">Lưu vào Google Drive</button>
                        <button onClick={handleSignOut} disabled={!isOnline} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 rounded-md transition duration-300 text-sm disabled:opacity-50">Đăng xuất</button>
                      </>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-4 mb-4 border-b border-slate-700 pb-4">
                <div className="flex gap-8 text-left">
                    <div>
                        <p className="text-sm text-slate-400">Tổng số sợi đã cắt</p>
                        <p className="text-2xl font-bold text-cyan-400">{cutLogSummary.totalCuts}</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-400">Tổng chiều dài đã cắt</p>
                        <p className="text-2xl font-bold text-cyan-400">{cutLogSummary.totalLength.toFixed(1)}m</p>
                    </div>
                </div>
                <button 
                  onClick={handleClearLog} 
                  disabled={cutLog.length === 0} 
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-3 rounded-md transition duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed text-sm"
                  title="Reset lại toàn bộ thống kê và xóa nhật ký cắt hiện tại."
                >
                  Reset Thống Kê
                </button>
            </div>
            
            {uploadMessage && (
                <div className="mb-4 p-3 rounded-md text-sm bg-slate-700 text-slate-300">{uploadMessage}</div>
            )}

            <div className="max-h-96 overflow-y-auto pr-2">
              {cutLog.length === 0 ? (
                <div className="flex items-center justify-center h-48">
                    <p className="text-slate-400">Chưa có lượt cắt nào được ghi nhận.</p>
                </div>
              ) : (
                <table className="w-full text-left table-auto">
                    <thead className="sticky top-0 bg-slate-800">
                        <tr>
                            <th className="p-3 text-sm font-semibold text-slate-300">Thời Gian</th>
                            <th className="p-3 text-sm font-semibold text-slate-300">Tên Cáp</th>
                            <th className="p-3 text-sm font-semibold text-slate-300">Chiều Dài</th>
                            <th className="p-3 text-sm font-semibold text-slate-300">Cuộn #</th>
                            <th className="p-3 text-sm font-semibold text-slate-300">Index Bắt Đầu</th>
                            <th className="p-3 text-sm font-semibold text-slate-300">Index Kết Thúc</th>
                            <th className="p-3 text-sm font-semibold text-slate-300">ID Lượt Cắt</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {cutLog.slice().reverse().map(entry => (
                            <tr key={entry.id} className="hover:bg-slate-700/50">
                                <td className="p-3 text-slate-400 whitespace-nowrap">{new Date(entry.timestamp).toLocaleString('vi-VN')}</td>
                                <td className="p-3 text-white">{entry.name}</td>
                                <td className="p-3 text-cyan-300">{entry.length.toFixed(1)}m</td>
                                <td className="p-3 text-center">{entry.reelId}</td>
                                <td className="p-3">{entry.startIndex.toFixed(1)}m</td>
                                <td className="p-3">{entry.endIndex.toFixed(1)}m</td>
                                <td className="p-3 text-xs text-slate-500">{entry.id}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
              )}
            </div>
        </section>
        
        {/* Render Install Guide Modal */}
        <InstallGuideModal isOpen={showInstallGuide} onClose={() => setShowInstallGuide(false)} />
        
      </div>
    </div>
  );
};

export default App;