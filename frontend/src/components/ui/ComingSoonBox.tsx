import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, Sparkles, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ComingSoonBoxProps {
  icon: LucideIcon;
  badgeText?: string;
  title: string;
  subtitle?: string;
  description: string;
  gradient?: string;
  iconColor?: string;
}

export const ComingSoonBox: React.FC<ComingSoonBoxProps> = ({
  icon: Icon,
  badgeText = 'COMING SOON',
  title,
  subtitle,
  description,
  gradient = 'from-amber-500 to-orange-500',
  iconColor = 'text-amber-500'
}) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-8">
      <div className="relative w-full max-w-md">
        {/* Ambient Subtle Glow Behind Box */}
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-amber-500/20 blur-xl opacity-70 pointer-events-none" />

        {/* Small Beautiful Box */}
        <div className="relative rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 shadow-2xl text-center space-y-5">
          {/* Top Badge & Glowing Icon */}
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} p-0.5 shadow-lg shadow-amber-500/10`}>
              <div className="w-full h-full rounded-[14px] bg-white dark:bg-slate-900 flex items-center justify-center">
                <Icon className={`w-7 h-7 ${iconColor}`} />
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/25">
              <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
              <span>{badgeText}</span>
            </div>
          </div>

          {/* Heading and Subtitle */}
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                {subtitle}
              </p>
            )}
          </div>

          {/* Clean Description */}
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm mx-auto">
            {description}
          </p>

          {/* Action Button */}
          <div className="pt-2 flex items-center justify-center">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
          </div>

          {/* Footer note */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Under active development • Zero mock data policy</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComingSoonBox;
