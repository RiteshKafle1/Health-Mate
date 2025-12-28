import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

export function Badge({ className, variant = 'neutral', children, ...props }: BadgeProps) {
    const variants = {
        primary: 'bg-primary/10 text-primary border-primary/20',
        success: 'bg-success-bg text-success border-success/30',
        warning: 'bg-warning-bg text-warning-DEFAULT border-warning/30',
        error: 'bg-error-bg text-error border-error/30',
        info: 'bg-info-bg text-info border-info/30',
        neutral: 'bg-surface/50 text-text-muted border-surface',
    };

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                variants[variant],
                className
            )}
            {...props}
        >
            {children}
        </span>
    );
}
