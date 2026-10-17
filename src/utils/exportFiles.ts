import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } from 'docx';
import { saveAs } from 'file-saver';

// Antarmuka data sesuai dengan tabel rsvp_responses PostgreSQL lokal.
interface RsvpData {
  created_at: string;
  guest_name: string;
  attendance_status: string;
  total_guest: number;
  wishes: string | null;
}

// ================= 1. FUNGSI UNDUH EXCEL (MENGGUNAKAN EXCELJS AMAN) =================
export const exportToExcel = async (data: RsvpData[]) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Data RSVP');

  // Membuat struktur kolom tabel
  worksheet.columns = [
    { header: 'No', key: 'no', width: 5 },
    { header: 'Waktu Konfirmasi', key: 'waktu', width: 25 },
    { header: 'Nama Tamu', key: 'nama', width: 25 },
    { header: 'Status Kehadiran', key: 'status', width: 20 },
    { header: 'Jumlah Personel', key: 'jumlah', width: 15 },
    { header: 'Ucapan & Doa', key: 'ucapan', width: 40 },
  ];

  // Menyisipkan baris data ke dalam Excel
  data.forEach((item, index) => {
    worksheet.addRow({
      no: index + 1,
      waktu: new Date(item.created_at).toLocaleString('id-ID'),
      nama: item.guest_name,
      status: item.attendance_status,
      jumlah: item.total_guest,
      ucapan: item.wishes || '-',
    });
  });

  // Membuat header tabel menjadi teks tebal
  worksheet.getRow(1).font = { bold: true };

  // Mengubah workbook menjadi blob file lalu mengunduhnya secara aman
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, 'Daftar_Kehadiran_Tamu.xlsx');
};

// ================= 2. FUNGSI UNDUH PDF =================
export const exportToPdf = (data: RsvpData[]) => {
  const doc = new jsPDF();
  
  doc.setFont('Helvetica', 'normal');
  doc.text('Daftar Konfirmasi Kehadiran Tamu (RSVP)', 14, 15);
  doc.setFontSize(10);
  doc.text(`Total Tamu: ${data.length} | Diunduh pada: ${new Date().toLocaleDateString('id-ID')}`, 14, 22);

  const tableRows = data.map((item, index) => [
    index + 1,
    item.guest_name,
    item.attendance_status,
    item.total_guest,
    item.wishes || '-'
  ]);

  // @ts-expect-error jspdf-autotable augments jsPDF at runtime.
  doc.autoTable({
    startY: 28,
    head: [['No', 'Nama Tamu', 'Status Kehadiran', 'Jumlah', 'Ucapan & Doa']],
    body: tableRows,
    theme: 'striped',
    headStyles: { fillColor: [111, 78, 55] }, // Menggunakan RGB untuk warna cokelat tua pastel (#6F4E37)
    styles: { fontSize: 9, font: 'Helvetica' }
  });

  doc.save('Daftar_Kehadiran_Tamu.pdf');
};

// ================= 3. FUNGSI UNDUH WORD (.DOCX) =================
export const exportToWord = (data: RsvpData[]) => {
  const tableRows = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'No', bold: true })] })], width: { size: 5, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Nama Tamu', bold: true })] })], width: { size: 25, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Status Kehadiran', bold: true })] })], width: { size: 20, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Jumlah', bold: true })] })], width: { size: 10, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Ucapan & Doa', bold: true })] })], width: { size: 40, type: WidthType.PERCENTAGE } }),
      ],
    }),
    ...data.map((item, index) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(index + 1) })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.guest_name })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.attendance_status })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(item.total_guest) })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.wishes || '-' })] })] }),
      ]
    }))
  ];

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [new TextRun({ text: 'LAPORAN DATA RSVP TAMU UNDANGAN', bold: true, size: 28 })],
          spacing: { after: 200 }
        }),
        new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE }
        })
      ],
    }],
  });

  Packer.toBlob(doc).then((blob) => {
    saveAs(blob, 'Daftar_Kehadiran_Tamu.docx');
  });
};