import React, { useState, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument } from 'pdf-lib';
import {
  FileText,
  FileSignature as Signature,
  Download,
  CheckCircle,
} from 'lucide-react';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface SignaturePosition {
  x: number;
  y: number;
}

function App() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  const [signaturePosition, setSignaturePosition] = useState<SignaturePosition>({ x: 50, y: 50 });
  const [signatureSize, setSignatureSize] = useState({ width: 100, height: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });

  const [downloadFileName, setDownloadFileName] = useState<string>(''); // custom file name

  const containerRef = useRef<HTMLDivElement>(null);
  const signatureRef = useRef<HTMLDivElement>(null);

  const handlePdfUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      // Default naam input box me daal dena (without extension)
      setDownloadFileName(file.name.replace('.pdf', ''));
      setDownloadComplete(false);
    }
  }, []);

  const handleSignatureUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSignatureFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setSignatureDataUrl(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
      setDownloadComplete(false);
    }
  }, []);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    setIsDragging(true);
    event.preventDefault();
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (isDragging && containerRef.current && signatureRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const signatureRect = signatureRef.current.getBoundingClientRect();

      const x = event.clientX - containerRect.left - signatureRect.width / 2;
      const y = event.clientY - containerRect.top - signatureRect.height / 2;

      const maxX = containerRect.width - signatureRect.width;
      const maxY = containerRect.height - signatureRect.height;

      setSignaturePosition({
        x: Math.max(0, Math.min(x, maxX)),
        y: Math.max(0, Math.min(y, maxY)),
      });
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const downloadSignedPdf = useCallback(async () => {
    if (!pdfFile || !signatureFile) return;
    setIsDownloading(true);

    try {
      const pdfBytes = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];

      const signatureBytes = await signatureFile.arrayBuffer();
      const signatureImage = signatureFile.type === 'image/png'
        ? await pdfDoc.embedPng(signatureBytes)
        : await pdfDoc.embedJpg(signatureBytes);

      const { width: pageWidth, height: pageHeight } = firstPage.getSize();
      const scaleX = pageWidth / pdfDimensions.width;
      const scaleY = pageHeight / pdfDimensions.height;

      const x = signaturePosition.x * scaleX;
      const y = pageHeight - (signaturePosition.y * scaleY) - (signatureSize.height);

      firstPage.drawImage(signatureImage, {
        x,
        y,
        width: signatureSize.width,
        height: signatureSize.height,
      });

      const modifiedPdfBytes = await pdfDoc.save();
      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // ✅ custom naam ya default naam set karo
      link.download = `${downloadFileName || 'signed-document'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadComplete(true);
      setTimeout(() => setDownloadComplete(false), 3000);
    } catch (error) {
      console.error('Error signing PDF:', error);
    } finally {
      setIsDownloading(false);
    }
  }, [pdfFile, signatureFile, signaturePosition, pdfDimensions, signatureSize, downloadFileName]);

  const onPageLoadSuccess = useCallback((page: any) => {
    setPdfDimensions({
      width: page.width,
      height: page.height,
    });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">PDF Signature Tool</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Upload your PDF document and signature, then drag and drop to sign your document digitally
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          <div className="lg:col-span-1 space-y-6">
            {/* PDF Upload */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center mb-4">
                <FileText className="w-6 h-6 text-blue-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Upload PDF</h3>
              </div>
              <input
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                className="w-full"
              />

              {pdfFile && (
                <div className="mt-4 p-3 border rounded-lg bg-gray-50">
                  <p className="text-sm text-gray-600 mb-1">Uploaded PDF:</p>
                  <p className="text-sm font-medium text-gray-800 truncate">{pdfFile.name}</p>

                  <label className="block text-sm font-medium text-gray-700 mt-3">
                    Download File Name
                  </label>
                  <input
                    type="text"
                    value={downloadFileName}
                    onChange={(e) => setDownloadFileName(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
              )}
            </div>

            {/* Signature Upload */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center mb-4">
                <Signature className="w-6 h-6 text-purple-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Upload Signature</h3>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleSignatureUpload}
                className="w-full"
              />

              {signatureDataUrl && (
                <div className="mt-4 p-3 border rounded-lg bg-gray-50">
                  <p className="text-sm text-gray-600 mb-2">Preview:</p>
                  <img
                    src={signatureDataUrl}
                    alt="Signature preview"
                    style={{
                      width: signatureSize.width,
                      height: signatureSize.height,
                      objectFit: 'fill',
                    }}
                    className="mx-auto mb-4 rounded border bg-white shadow"
                  />

                  <label className="block text-sm font-medium text-gray-700">Width (px)</label>
                  <input
                    type="number"
                    value={signatureSize.width}
                    onChange={(e) =>
                      setSignatureSize({ ...signatureSize, width: Number(e.target.value) })
                    }
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />

                  <label className="block text-sm font-medium text-gray-700 mt-2">Height (px)</label>
                  <input
                    type="number"
                    value={signatureSize.height}
                    onChange={(e) =>
                      setSignatureSize({ ...signatureSize, height: Number(e.target.value) })
                    }
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
              )}
            </div>

            {/* Download Button */}
            {pdfFile && signatureFile && (
              <button
                onClick={downloadSignedPdf}
                disabled={isDownloading}
                className={`w-full flex items-center justify-center px-6 py-4 rounded-xl font-semibold text-white transition-all transform hover:scale-105 ${
                  downloadComplete
                    ? 'bg-green-600 hover:bg-green-700'
                    : isDownloading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-lg'
                }`}
              >
                {downloadComplete ? (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Downloaded Successfully!
                  </>
                ) : isDownloading ? (
                  <>
                    <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    Download Signed PDF
                  </>
                )}
              </button>
            )}
          </div>

          {/* PDF Preview */}
          <div className="lg:col-span-2">
            <div
              ref={containerRef}
              className="relative border rounded-xl shadow-lg p-6 bg-white border-gray-100"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {pdfFile ? (
                <>
                  <Document file={pdfFile}>
                    <Page
                      pageNumber={1}
                      onLoadSuccess={onPageLoadSuccess}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </Document>

                  {signatureDataUrl && (
                    <div
                      ref={signatureRef}
                      className="absolute cursor-move select-none"
                      style={{
                        left: `${signaturePosition.x}px`,
                        top: `${signaturePosition.y}px`,
                        width: `${signatureSize.width}px`,
                        height: `${signatureSize.height}px`,
                        zIndex: 10,
                      }}
                      onMouseDown={handleMouseDown}
                    >
                      <img
                        src={signatureDataUrl}
                        alt="Signature"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'fill',
                        }}
                        className="bg-white rounded border-2 border-blue-400 shadow-lg"
                        draggable={false}
                      />
                      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-blue-600 font-medium whitespace-nowrap">
                        Drag to position
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-center text-gray-500">Upload a PDF to see preview</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
