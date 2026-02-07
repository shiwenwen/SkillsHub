import { ReactNode, HTMLAttributes } from "react";

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
    children: ReactNode;
    className?: string;
    noPadding?: boolean;
    title?: string | ReactNode;
    icon?: ReactNode;
    actions?: ReactNode;
}

export function Card({ children, className = "", noPadding = false, title, icon, actions, ...props }: CardProps) {
    return (
        <div className={`glass-card ${noPadding ? "" : "p-6"} ${className}`} {...props}>
            {(title || icon || actions) && (
                <div className={`flex items-center justify-between mb-6 ${noPadding ? "px-6 pt-6" : ""}`}>
                    <div className="flex items-center gap-3">
                        {icon && (
                            <div className="p-2 rounded-lg bg-base-200/50 text-base-content/70 shadow-sm border border-base-content/5">
                                {icon}
                            </div>
                        )}
                        {title && <h3 className="font-bold text-lg">{title}</h3>}
                    </div>
                    {actions && <div className="flex items-center gap-2">{actions}</div>}
                </div>
            )}
            {children}
        </div>
    );
}

export function CardHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <div className={`flex flex-col gap-1 mb-6 ${className}`}>
            {children}
        </div>
    );
}

export function CardTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <h3 className={`text-lg font-semibold text-base-content ${className}`}>
            {children}
        </h3>
    );
}

export function CardDescription({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <p className={`text-sm text-base-content/60 ${className}`}>
            {children}
        </p>
    );
}
