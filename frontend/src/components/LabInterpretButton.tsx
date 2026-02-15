import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';

interface LabInterpretButtonProps {
    reportId: string;
    className?: string;
    isInterpreted?: boolean;
}

export function LabInterpretButton({
    reportId,
    className = '',
    isInterpreted = false
}: LabInterpretButtonProps) {
    const navigate = useNavigate();

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        // Store report name in history state if needed, but ID is enough to fetch
        navigate(`/user/reports/analysis/${reportId}`);
    };

    return (
        <button
            onClick={handleClick}
            className={`
                inline-flex items-center justify-center px-4 py-2 
                text-white font-medium rounded-lg 
                transition-all duration-200
                ${isInterpreted
                    ? 'bg-[#2D336B] text-white border border-[#2D336B] hover:bg-[#1a1e40] shadow-md shadow-[#2D336B]/20'
                    : 'bg-gradient-to-r from-[#7886C7] to-[#A9B5DF] shadow-lg shadow-[#7886C7]/25 hover:shadow-[#7886C7]/40 hover:-translate-y-0.5'
                }
                ${className}
            `}
        >
            <FileText size={16} className="mr-2" />
            {isInterpreted ? 'View Analysis' : 'Interpret Report'}
        </button>
    );
}
