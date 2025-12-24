import { type ReactNode } from 'react';
import { Check } from 'lucide-react';

interface OptionChipProps {
    label: string;
    onClick: () => void;
    selected?: boolean;
    icon?: ReactNode;
    disabled?: boolean;
}

export function OptionChip({ label, onClick, selected = false, icon, disabled = false }: OptionChipProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                relative flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium
                transition-all duration-200 ease-out
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${selected
                    ? 'bg-purple-500/30 text-purple-200 border-2 border-purple-500 shadow-lg shadow-purple-500/20'
                    : 'bg-slate-700/50 text-slate-300 border border-slate-600/50 hover:bg-slate-600/50 hover:text-white hover:border-slate-500 hover:scale-[1.02] active:scale-[0.98]'
                }
            `}
        >
            {icon && <span className="text-lg">{icon}</span>}
            <span className="flex-1 text-left">{label}</span>
            {selected && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                </span>
            )}
        </button>
    );
}
