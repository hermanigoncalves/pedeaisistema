import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, FileSpreadsheet, FileJson } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportToPDF, exportToExcel, exportToCSV, exportToJSON, ExportData } from '@/lib/export-utils';
import { toast } from 'sonner';

interface ExportReportsProps {
    data: ExportData;
}

const ExportReports: React.FC<ExportReportsProps> = ({ data }) => {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async (format: 'pdf' | 'excel' | 'csv' | 'json') => {
        setIsExporting(true);
        try {
            switch (format) {
                case 'pdf':
                    exportToPDF(data);
                    toast.success('Relatório PDF exportado com sucesso!');
                    break;
                case 'excel':
                    exportToExcel(data);
                    toast.success('Relatório Excel exportado com sucesso!');
                    break;
                case 'csv':
                    exportToCSV(data);
                    toast.success('Relatório CSV exportado com sucesso!');
                    break;
                case 'json':
                    exportToJSON(data);
                    toast.success('Dados JSON exportados com sucesso!');
                    break;
            }
        } catch (error) {
            console.error('Erro ao exportar:', error);
            toast.error('Erro ao exportar relatório');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    className="gap-2"
                    disabled={isExporting}
                >
                    <Download className="w-4 h-4" />
                    Exportar Relatório
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-2 cursor-pointer">
                    <FileText className="w-4 h-4" />
                    Exportar PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('excel')} className="gap-2 cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4" />
                    Exportar Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('csv')} className="gap-2 cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4" />
                    Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('json')} className="gap-2 cursor-pointer">
                    <FileJson className="w-4 h-4" />
                    Exportar JSON
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default ExportReports;
