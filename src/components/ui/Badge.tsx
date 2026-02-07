import { ReactNode } from "react";

interface BadgeProps {
    children: ReactNode;
    variant?: "default" | "outline" | "secondary" | "accent" | "success" | "warning" | "error" | "neutral" | "primary" | "info" | "ghost" | "link";
    size?: "xs" | "sm" | "md" | "lg";
    className?: string;
}

export function Badge({ children, variant = "default", size = "md", className = "" }: BadgeProps) {
    const variants = {
        default: "bg-base-200 text-base-content border-base-300",
        neutral: "bg-base-200 text-base-content/80 border-base-300",
        primary: "bg-primary/10 text-primary border-primary/20",
        secondary: "bg-secondary/10 text-secondary border-secondary/20",
        accent: "bg-accent/10 text-accent border-accent/20",
        success: "bg-success/10 text-success border-success/20",
        warning: "bg-warning/10 text-warning border-warning/20",
        error: "bg-error/10 text-error border-error/20",
        info: "bg-info/10 text-info border-info/20",
        outline: "bg-transparent border-base-content/20 text-base-content/70",
        ghost: "bg-transparent border-transparent text-base-content/60",
        link: "bg-transparent border-transparent text-primary underline underline-offset-2",
    };

    const sizes = {
        xs: "text-[10px] px-1.5 py-0.5 h-5",
        sm: "text-xs px-2 py-0.5 h-6",
        md: "text-xs px-2.5 py-1 h-7",
        lg: "text-sm px-3 py-1 h-8",
    };

    return (
        <span className={`inline-flex items-center justify-center rounded-full font-medium border ${variants[variant]} ${sizes[size]} ${className}`}>
            {children}
        </span>
    );
}
