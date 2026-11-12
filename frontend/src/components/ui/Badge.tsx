import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  type?: 'success' | 'danger' | 'neutral' | 'warning' | 'primary' | 'secondary';
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ children, type = 'neutral', className = '' }) => {
  const styles = {
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-200/50',
    danger: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border-rose-200/50',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200/50',
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200',
    primary: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-200/50',
    secondary: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-200/50',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${styles[type]} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;