import { X, Download, ZoomIn, ZoomOut, RotateCw, Maximize2 } from 'lucide-react';
import { useState } from 'react';

interface ReportViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    fileUrl: string;
    fileName: string;
    fileType: string;
}

export function ReportViewerModal({
    isOpen,
    onClose,
    fileUrl,
    fileName,
    fileType
}: ReportViewerModalProps) {
    const [zoom, setZoom] = useState(100);
    const [rotation, setRotation] = useState(0);

    if (!isOpen) return null;

    const isPdf = fileType === 'application/pdf';
    const isImage = fileType.startsWith('image/');
    const isVideo = fileType.startsWith('video/');

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
    const handleRotate = () => setRotation(prev => (prev + 90) % 360);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleFullscreen = () => {
        window.open(fileUrl, '_blank');
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleBackdropClick}
        >
            {/* Modal Container */}
            <div className="relative w-full max-w-5xl h-[90vh] mx-4 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#A9B5DF]/30 bg-[#FFF2F2]">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-[#2D336B] truncate">
                            {fileName}
                        </h2>
                        <p className="text-sm text-[#2D336B]/60">
                            {isPdf ? 'PDF Document' : isImage ? 'Image' : isVideo ? 'Video' : 'File'}
                        </p>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2">
                        {isImage && (
                            <>
                                <button
                                    onClick={handleZoomOut}
                                    className="p-2 text-[#2D336B]/70 hover:text-[#2D336B] hover:bg-[#A9B5DF]/20 rounded-lg transition-colors"
                                    title="Zoom Out"
                                >
                                    <ZoomOut size={20} />
                                </button>
                                <span className="text-sm text-[#2D336B]/60 min-w-[50px] text-center">
                                    {zoom}%
                                </span>
                                <button
                                    onClick={handleZoomIn}
                                    className="p-2 text-[#2D336B]/70 hover:text-[#2D336B] hover:bg-[#A9B5DF]/20 rounded-lg transition-colors"
                                    title="Zoom In"
                                >
                                    <ZoomIn size={20} />
                                </button>
                                <button
                                    onClick={handleRotate}
                                    className="p-2 text-[#2D336B]/70 hover:text-[#2D336B] hover:bg-[#A9B5DF]/20 rounded-lg transition-colors"
                                    title="Rotate"
                                >
                                    <RotateCw size={20} />
                                </button>
                                <div className="w-px h-6 bg-[#A9B5DF]/30 mx-1" />
                            </>
                        )}

                        <button
                            onClick={handleFullscreen}
                            className="p-2 text-[#2D336B]/70 hover:text-[#2D336B] hover:bg-[#A9B5DF]/20 rounded-lg transition-colors"
                            title="Open in New Tab"
                        >
                            <Maximize2 size={20} />
                        </button>

                        <a
                            href={fileUrl}
                            download={fileName}
                            className="p-2 text-[#7886C7] hover:text-[#2D336B] hover:bg-[#A9B5DF]/20 rounded-lg transition-colors"
                            title="Download"
                        >
                            <Download size={20} />
                        </a>

                        <button
                            onClick={onClose}
                            className="p-2 ml-2 text-[#2D336B]/70 hover:text-white hover:bg-red-500 rounded-lg transition-colors"
                            title="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto bg-[#2D336B]/5 flex items-center justify-center p-4">
                    {isPdf && (
                        <iframe
                            src={`${fileUrl}#toolbar=1&navpanes=0`}
                            className="w-full h-full rounded-lg bg-white shadow-inner"
                            title={fileName}
                        />
                    )}

                    {isImage && (
                        <div className="flex items-center justify-center w-full h-full overflow-auto">
                            <img
                                src={fileUrl}
                                alt={fileName}
                                className="max-w-none transition-transform duration-300 rounded-lg shadow-lg"
                                style={{
                                    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                                }}
                            />
                        </div>
                    )}

                    {isVideo && (
                        <video
                            src={fileUrl}
                            controls
                            className="max-w-full max-h-full rounded-lg shadow-lg"
                        >
                            Your browser does not support video playback.
                        </video>
                    )}

                    {!isPdf && !isImage && !isVideo && (
                        <div className="text-center p-8">
                            <p className="text-[#2D336B]/70 mb-4">
                                Preview not available for this file type
                            </p>
                            <a
                                href={fileUrl}
                                download={fileName}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D336B] text-white rounded-lg hover:bg-[#2D336B]/90 transition-colors"
                            >
                                <Download size={18} />
                                Download File
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
