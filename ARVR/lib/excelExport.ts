import ExcelJS from 'exceljs';

export interface CertificateExportRow {
  studentName: string;
  registerNo: string;
  startDate: string;
  endDate: string;
  grade: string;
  level: string;
  certificateNo: string;
}

export async function generateCertificateExcel(
  batchName: string,
  records: CertificateExportRow[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AR/VR Training Management Portal';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(`Certificates - ${batchName}`);

  worksheet.columns = [
    { header: 'Student Name', key: 'studentName', width: 25 },
    { header: 'Reg No', key: 'registerNo', width: 18 },
    { header: 'Start Date', key: 'startDate', width: 15 },
    { header: 'End Date', key: 'endDate', width: 15 },
    { header: 'Grade', key: 'grade', width: 12 },
    { header: 'Level', key: 'level', width: 15 },
    { header: 'Certificate No', key: 'certificateNo', width: 25 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1E293B' }, // Slate 800
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Add data rows
  records.forEach((record) => {
    const row = worksheet.addRow(record);
    row.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
