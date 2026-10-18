import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface SlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  widthClass?: string;
}

export const SlideOver: React.FC<SlideOverProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  widthClass = 'max-w-xl'
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex pl-10 max-w-full pointer-events-none">
        <div className={`w-screen ${widthClass} pointer-events-auto transform transition-transform ease-out duration-300 animate-in slide-in-from-right sm:duration-300 bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col`}>
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-800/80 bg-slate-900/95 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="w-9 h-9 rounded-lg bg-rose-950/50 border border-rose-900/40 text-rose-300 flex items-center justify-center shrink-0">
                  {icon}
                </div>
              )}
              <div>
                <h2 className="text-base font-semibold text-slate-100 font-sans tracking-tight">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Fermer (Échap)"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar text-slate-200">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlideOver;
