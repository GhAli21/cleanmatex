'use client';

import { useTranslations } from 'next-intl';
import { useState, useRef, useEffect } from 'react';
import { Download, FileText, Table, Printer } from 'lucide-react';

interface ExportDropdownProps {
  onExportCSV: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
  onPrint: () => void;
  isExporting?: boolean;
}

/**
 *
 * @param root0
 * @param root0.onExportCSV
 * @param root0.onExportExcel
 * @param root0.onExportPDF
 * @param root0.onPrint
 * @param root0.isExporting
 */
export default function ExportDropdown({
  onExportCSV,
  onExportExcel,
  onExportPDF,
  onPrint,
  isExporting,
}: ExportDropdownProps) {
  const t = useTranslations('reports');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleAction = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={isExporting}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        {isExporting ? t('export.downloading') : t('exportReport')}
      </button>

      {open && (
        <div className="absolute end-0 z-10 mt-1 w-44 rounded-lg border border-border bg-card py-1 shadow-lg">
          <button
            onClick={() => handleAction(onExportCSV)}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            <Table className="h-4 w-4 text-success-text" />
            {t('exportCSV')}
          </button>
          <button
            onClick={() => handleAction(onExportExcel)}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            <Table className="h-4 w-4 text-primary-text" />
            {t('exportExcel')}
          </button>
          <button
            onClick={() => handleAction(onExportPDF)}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            <FileText className="h-4 w-4 text-danger-text" />
            {t('exportPDF')}
          </button>
          <hr className="my-1 border-border" />
          <button
            onClick={() => handleAction(onPrint)}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            <Printer className="h-4 w-4 text-muted-foreground" />
            {t('print')}
          </button>
        </div>
      )}
    </div>
  );
}
