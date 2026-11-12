import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  hoverEffect?: boolean;
  style?: React.CSSProperties;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = "", 
  noPadding = false,
  hoverEffect = false,
  style = {},
  onClick
}) => {
  return (
    <div 
      onClick={onClick}
      className={`
        relative overflow-hidden
        bg-white dark:bg-slate-950 
        backdrop-blur-none 
        border border-slate-200/80 dark:border-slate-800/80 
        shadow-sm dark:shadow-lg rounded-2xl 
        ${hoverEffect ? 'transition-all duration-300 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-950' : ''}
        ${noPadding ? '' : 'p-6'}
        ${className}
      `}
      style={style}
    >
      {children}
    </div>
  );
};

export default GlassCard;