/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Scan,
  X,
  Camera,
  Keyboard,
  ArrowRight,
  Package,
  AlertCircle,
  CheckCircle2,
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  MapPin,
} from 'lucide-react';
import { InventoryItem } from '../../types';
import { api } from '../../services/api';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectItem?: (
    item: InventoryItem,
    action?: 'RECEIVE' | 'ISSUE' | 'TRANSFER' | 'COUNT' | 'STOCK_CARD'
  ) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onSelectItem,
}) => {
  const [manualInput, setManualInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedItem, setScannedItem] = useState<InventoryItem | null>(null);
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus input when modal opens or manual mode selected
  useEffect(() => {
    if (isOpen && mode === 'manual') {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, mode]);

  // Start/Stop Camera
  useEffect(() => {
    let animationFrameId: number;

    const startCamera = async () => {
      setCameraError(null);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera device access is not supported by this browser environment.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraActive(true);

          // If native BarcodeDetector is available, run scanner loop
          if ('BarcodeDetector' in window) {
            // @ts-ignore
            const detector = new (window as any).BarcodeDetector({
              formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a'],
            });

            const scanLoop = async () => {
              if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                try {
                  const barcodes = await detector.detect(videoRef.current);
                  if (barcodes.length > 0) {
                    const raw = barcodes[0].rawValue;
                    if (raw) {
                      handleLookup(raw);
                      return; // pause detection on match
                    }
                  }
                } catch (e) {
                  // ignore frame error
                }
              }
              animationFrameId = requestAnimationFrame(scanLoop);
            };

            animationFrameId = requestAnimationFrame(scanLoop);
          }
        }
      } catch (err: any) {
        console.warn('Camera initiation note:', err?.message || err);
        setCameraError(err.message || 'Unable to start camera stream. Use manual entry or quick presets.');
        setCameraActive(false);
        setMode('manual');
      }
    };

    if (isOpen && mode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen, mode]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleLookup = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    try {
      const item = await api.lookupBarcode(trimmed);
      setScannedItem(item);
    } catch (err: any) {
      setError(err.message || `No item recognized with barcode "${trimmed}".`);
      setScannedItem(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleLookup(manualInput.trim());
    }
  };

  const handleAction = (action: 'RECEIVE' | 'ISSUE' | 'TRANSFER' | 'COUNT' | 'STOCK_CARD') => {
    if (scannedItem && onSelectItem) {
      onSelectItem(scannedItem, action);
      onClose();
    }
  };

  if (!isOpen) return null;

  // Sample quick presets for testing
  const presets = [
    { label: 'Jasmine Rice 20kg', barcode: '8992753110201' },
    { label: 'Cooking Oil 5L', barcode: '8998866200115' },
    { label: 'Mineral Water 600ml', barcode: '8991234567890' },
    { label: 'Hotel Dental Kit', barcode: 'ATR-HK-DENT01' },
    { label: 'Disinfectant 5L', barcode: '8993005120011' },
    { label: 'LED Bulb 9W', barcode: '8718696700123' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-xs overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-slate-900/10 border border-emerald-500/30 text-emerald-700">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Interactive Barcode Scanner</h3>
              <p className="text-xs text-slate-500">Scan manufacturer or ATRIUM internal barcodes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="px-5 pt-3 flex gap-2 border-b border-slate-200/60 pb-3 bg-white">
          <button
            type="button"
            onClick={() => setMode('camera')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
              mode === 'camera'
                ? 'bg-slate-900 text-white font-semibold'
                : 'bg-white/80 text-slate-700 hover:bg-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera Optical Scanner</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
              mode === 'manual'
                ? 'bg-slate-900 text-white font-semibold'
                : 'bg-white/80 text-slate-700 hover:bg-white'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>USB / Keyboard Entry</span>
          </button>
        </div>

        {/* Body Area */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Camera Viewfinder */}
          {mode === 'camera' && (
            <div className="relative rounded-xl overflow-hidden bg-black border border-slate-200 aspect-video flex items-center justify-center">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />

              {/* Viewfinder Target Graphic */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-36 border-2 border-emerald-400/80 rounded-lg relative shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  {/* Laser line animation */}
                  <div className="absolute left-0 right-0 h-0.5 bg-emerald-400 animate-pulse top-1/2 -translate-y-1/2" />
                  <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-300" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-300" />
                  <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-300" />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-300" />
                </div>
              </div>

              {!cameraActive && (
                <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center text-center p-4">
                  <Camera className="w-8 h-8 text-slate-500 mb-2" />
                  <p className="text-xs text-slate-700 mb-2">
                    {cameraError || 'Initializing video feed...'}
                  </p>
                  <button
                    onClick={() => setMode('manual')}
                    className="text-xs text-emerald-700 underline hover:text-emerald-700"
                  >
                    Switch to manual barcode input
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Barcode Input Form (Physical Scanner / Manual) */}
          <form onSubmit={handleSubmitManual} className="space-y-2">
            <label className="text-xs font-mono text-slate-500 uppercase tracking-wider block">
              Scan with USB Scanner or Enter Barcode:
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Scan className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={inputRef}
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="e.g. 8991234567890 or ATR-FB-CHK01"
                  className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !manualInput.trim()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Lookup'}
              </button>
            </div>
          </form>

          {/* Quick Preset Barcode Chips */}
          <div className="pt-1">
            <span className="text-[11px] font-mono text-slate-500 block mb-1.5">
              Quick Test Presets (Instant Simulation):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.barcode}
                  type="button"
                  onClick={() => {
                    setManualInput(p.barcode);
                    handleLookup(p.barcode);
                  }}
                  className="text-[11px] px-2.5 py-1 rounded bg-white/80 hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <span className="text-emerald-700 font-mono font-medium">{p.barcode}</span>
                  <span className="text-slate-500">({p.label})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Error notice */}
          {error && (
            <div className="p-3 rounded-lg bg-red-600/10/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Scanned Item Detail Card */}
          {scannedItem && (
            <div className="rounded-xl border border-emerald-500/40 bg-white/80 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded bg-slate-900/20 text-emerald-700 text-[11px] font-mono font-bold">
                      {scannedItem.item_code}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Barcode: {scannedItem.barcode}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">{scannedItem.item_name}</h4>
                  <p className="text-xs text-slate-500">
                    Category: {scannedItem.subcategory} • Supplier: {scannedItem.supplier}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-mono uppercase text-slate-500 block">Total Hotel Stock</span>
                  <div className="text-lg font-bold font-mono text-emerald-700">
                    {(scannedItem.current_stock ?? 0).toLocaleString()} {scannedItem.uom}
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 block">
                    Avg Cost: Rp {(scannedItem.average_cost ?? 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Storeroom Stocks */}
              {scannedItem.storeroom_stocks && scannedItem.storeroom_stocks.length > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-mono text-slate-500 block mb-1">
                    Stock Breakdown by Storeroom:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {scannedItem.storeroom_stocks.map((st) => (
                      <div
                        key={st.storeroom_id}
                        className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-emerald-700" />
                          <span className="font-mono text-slate-700">{st.storeroom_id}</span>
                          <span className="text-slate-500 text-[10px] font-mono">({st.bin_location})</span>
                        </div>
                        <span className="font-mono font-bold text-white">
                          {(st.quantity ?? 0).toLocaleString()} {scannedItem.uom}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="pt-3 border-t border-slate-200">
                <span className="text-[11px] font-mono text-slate-500 block mb-2">
                  Execute Inventory Action with Scanned Item:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleAction('RECEIVE')}
                    className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>Receive (IN)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAction('ISSUE')}
                    className="p-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Issue (OUT)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAction('TRANSFER')}
                    className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Transfer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAction('STOCK_CARD')}
                    className="p-2 rounded-lg bg-white hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Stock Card</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500">
          <span>Supported: EAN-13, Code-128, QR, Internal ATRIUM barcodes</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-700 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
