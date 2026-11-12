import React, { useState, useEffect, useCallback } from 'react';
import { 
  Key, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  LogOut, 
  Clock, 
  Radio 
} from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import Button from '../ui/Button';
import { 
  getUpstoxStatus, 
  getUpstoxAuthUrl, 
  disconnectUpstox, 
  type UpstoxStatusResponse 
} from '../../services/stockService';

interface UpstoxSessionCardProps {
  onNotification?: (type: 'success' | 'error', message: string) => void;
}

export const UpstoxSessionCard: React.FC<UpstoxSessionCardProps> = ({ onNotification }) => {
  const [statusData, setStatusData] = useState<UpstoxStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getUpstoxStatus();
      setStatusData(res);
    } catch (err: any) {
      console.error('Error fetching Upstox status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // Listen for postMessage from OAuth popup callback
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'UPSTOX_AUTH_SUCCESS') {
        fetchStatus();
        onNotification?.('success', 'Upstox session authenticated successfully! Live market movers active.');
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, [fetchStatus, onNotification]);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const res = await getUpstoxAuthUrl();
      if (!res.success || !res.url) {
        onNotification?.('error', 'Failed to generate Upstox auth URL. Check UPSTOX_API_KEY in backend .env.');
        return;
      }

      // Open OAuth dialog in a focused popup window
      const popup = window.open(
        res.url,
        'UpstoxOAuthLogin',
        'width=600,height=750,menubar=no,toolbar=no,location=no,status=no'
      );

      // Poll in background in case popup closes or opener communication is blocked
      const timer = setInterval(async () => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          setConnecting(false);
          await fetchStatus();
        }
      }, 2000);

      // Timeout safety after 90 seconds
      setTimeout(() => {
        clearInterval(timer);
        setConnecting(false);
      }, 90000);
    } catch (err: any) {
      console.error('Upstox connect error:', err);
      onNotification?.('error', err.response?.data?.message || 'Error opening Upstox authentication window');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect your active Upstox session token? Live mover rankings will fall back to EOD snapshots until reconnected.')) {
      return;
    }

    try {
      setDisconnecting(true);
      const res = await disconnectUpstox();
      if (res.success) {
        onNotification?.('success', 'Upstox session disconnected.');
        await fetchStatus();
      } else {
        onNotification?.('error', res.message || 'Failed to disconnect Upstox session');
      }
    } catch (err: any) {
      onNotification?.('error', err.response?.data?.message || 'Error disconnecting Upstox session');
    } finally {
      setDisconnecting(false);
    }
  };

  const hasActiveToken = Boolean(statusData?.hasActiveToken);
  const obtainedAt = statusData?.tokenInfo?.obtainedAt 
    ? new Date(statusData.tokenInfo.obtainedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    : null;

  return (
    <GlassCard className="p-4 sm:p-5 border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Provider info & Status Badge */}
        <div className="flex items-start gap-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            hasActiveToken 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
          }`}>
            <Radio className={`w-5 h-5 ${hasActiveToken ? 'animate-pulse' : ''}`} />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                Upstox Live Exchange Feed
              </h3>
              {loading ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                  Checking...
                </span>
              ) : hasActiveToken ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Active Session
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  <AlertCircle className="w-3 h-3" />
                  Session Offline
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
              {hasActiveToken
                ? `Authorized for live trading hours (09:15 - 15:30 IST). Powers Smartlist Market Movers & institutional FII/DII cash flows. Session token active until 03:30 AM IST.`
                : `Session token is offline or expired. Connect once every morning before 09:15 AM to enable live exchange rankings and real-time gainers/losers.`}
            </p>

            {hasActiveToken && obtainedAt && (
              <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400 font-mono">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Connected today at {obtainedAt}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <ShieldCheck className="w-3 h-3" /> OAuth 2FA Verified
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 self-start lg:self-center shrink-0">
          <Button
            onClick={fetchStatus}
            disabled={loading}
            variant="ghost"
            className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700"
            title="Refresh Token Health Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {hasActiveToken ? (
            <Button
              onClick={handleDisconnect}
              disabled={disconnecting}
              variant="ghost"
              className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-rose-500/20"
              title="Disconnect active session token"
            >
              <LogOut className="w-3.5 h-3.5" />
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={connecting}
              variant="primary"
              className="flex items-center gap-1.5 text-xs font-bold text-white shadow-md shadow-indigo-600/30"
              title="1-Click Upstox OAuth Authentication"
            >
              <Key className="w-3.5 h-3.5" />
              {connecting ? 'Waiting for Login...' : 'Connect Upstox Session (1-Click)'}
            </Button>
          )}
        </div>
      </div>
    </GlassCard>
  );
};

export default UpstoxSessionCard;
