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
        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        {isExporting ? t('export.downloading') : t('exportReport')}
      </button>

      {open && (
        <div className="absolute end-0 z-10 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <button
            onClick={() => handleAction(onExportCSV)}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Table className="h-4 w-4 text-green-600" />
            {t('exportCSV')}
          </button>
          <button
            onClick={() => handleAction(onExportExcel)}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Table className="h-4 w-4 text-blue-600" />
            {t('exportExcel')}
          </button>
          <button
            onClick={() => handleAction(onExportPDF)}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <FileText className="h-4 w-4 text-red-600" />
            {t('exportPDF')}
          </button>
          <hr className="my-1 border-gray-100" />
          <button
            onClick={() => handleAction(onPrint)}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Printer className="h-4 w-4 text-gray-600" />
            {t('print')}
          </button>
        </div>
      )}
    </div>
  );
}
