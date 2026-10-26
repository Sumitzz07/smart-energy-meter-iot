// ============================================================
// /api/telemetry/export — Telemetry Data Export API (CSV & PDF)
// ============================================================
// Streams or downloads real telemetry records from public.energy_readings
// for selected device and time range. Paginates queries to prevent silent
// truncation and enforces access security.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { formatIST } from '@/lib/notifications/gmail-smtp';
import type { EnergyReading } from '@/lib/types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const format = (searchParams.get('format') || 'csv').toLowerCase();
    const deviceId = searchParams.get('device_id') || 'all';
    const range = searchParams.get('range') || '24h';
    const customStart = searchParams.get('start');
    const customEnd = searchParams.get('end');

    // 1. Calculate time boundaries
    const now = new Date();
    let startTime: Date | null = null;
    let endTime: Date | null = null;

    if (customStart && customEnd) {
      startTime = new Date(customStart);
      endTime = new Date(customEnd);
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        return NextResponse.json({ error: 'Invalid custom date format' }, { status: 400 });
      }
    } else {
      endTime = now;
      if (range === '1h') {
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
      } else if (range === '24h') {
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (range === '7d') {
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (range === '30d') {
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (range === 'all') {
        startTime = null; // No lower bound
      }
    }

    // 2. Paginated Fetch from Supabase (prevents 1,000 row truncation limit)
    let allReadings: EnergyReading[] = [];
    const pageSize = 1000;
    let page = 0;
    const maxPages = 50; // Safety cap at 50,000 records

    while (page < maxPages) {
      let query = supabaseServer
        .from('energy_readings')
        .select('*')
        .order('timestamp', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (deviceId !== 'all') {
        query = query.eq('device_id', deviceId);
      }
      if (startTime) {
        query = query.gte('timestamp', startTime.toISOString());
      }
      if (endTime) {
        query = query.lte('timestamp', endTime.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('[/api/telemetry/export] Database error:', error);
        return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
      }

      if (!data || data.length === 0) break;

      allReadings = allReadings.concat(data as EnergyReading[]);

      if (data.length < pageSize) break; // Last page reached
      page++;
    }

    if (allReadings.length === 0) {
      return NextResponse.json(
        { error: 'No telemetry records found for the selected device and time range.' },
        { status: 404 }
      );
    }

    const safeDeviceName = deviceId === 'all' ? 'all_devices' : deviceId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    // ============================================================
    // A. CSV EXPORT
    // ============================================================
    if (format === 'csv') {
      const headers = [
        'Timestamp (ISO)',
        'Timestamp (IST)',
        'Device ID',
        'Voltage (V)',
        'Current (A)',
        'Power (W)',
        'Energy (kWh)',
        'Frequency (Hz)',
        'Power Factor',
        'Cost (INR)',
        'Protection Status',
      ];

      const csvRows = [headers.join(',')];

      for (const r of allReadings) {
        const timeIso = r.timestamp;
        const timeIst = formatIST(r.timestamp);
        const row = [
          `"${timeIso}"`,
          `"${timeIst.replace(/"/g, '""')}"`,
          `"${r.device_id}"`,
          Number(r.voltage || 0).toFixed(2),
          Number(r.current_amps || 0).toFixed(3),
          Number(r.power || 0).toFixed(2),
          Number(r.energy_kwh || 0).toFixed(4),
          Number(r.frequency || 0).toFixed(1),
          Number(r.power_factor || 0).toFixed(2),
          Number(r.cost || 0).toFixed(2),
          `"${r.protection_status || 'normal'}"`,
        ];
        csvRows.push(row.join(','));
      }

      const csvContent = csvRows.join('\r\n');
      const filename = `energy_telemetry_${safeDeviceName}_${range}_${timestampStr}.csv`;

      return new Response(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // ============================================================
    // B. PDF EXPORT
    // ============================================================
    if (format === 'pdf') {
      // Calculate executive summary metrics
      let sumPower = 0;
      let peakPower = 0;
      let sumVoltage = 0;
      let maxVoltage = 0;
      let minVoltage = Infinity;
      let sumCurrent = 0;
      let maxCurrent = 0;
      let sumFreq = 0;
      let sumPf = 0;

      const firstReading = allReadings[0];
      const lastReading = allReadings[allReadings.length - 1];
      const totalEnergy = Math.max(0, (lastReading.energy_kwh || 0) - (firstReading.energy_kwh || 0));
      const totalCost = Math.max(0, (lastReading.cost || 0) - (firstReading.cost || 0));

      for (const r of allReadings) {
        const p = Number(r.power || 0);
        const v = Number(r.voltage || 0);
        const c = Number(r.current_amps || 0);
        const f = Number(r.frequency || 0);
        const pf = Number(r.power_factor || 0);

        sumPower += p;
        if (p > peakPower) peakPower = p;

        sumVoltage += v;
        if (v > maxVoltage) maxVoltage = v;
        if (v < minVoltage && v > 0) minVoltage = v;

        sumCurrent += c;
        if (c > maxCurrent) maxCurrent = c;

        sumFreq += f;
        sumPf += pf;
      }

      const count = allReadings.length;
      const avgPower = count > 0 ? sumPower / count : 0;
      const avgVoltage = count > 0 ? sumVoltage / count : 0;
      const avgCurrent = count > 0 ? sumCurrent / count : 0;
      const avgFreq = count > 0 ? sumFreq / count : 0;
      const avgPf = count > 0 ? sumPf / count : 0;

      // Initialize landscape A4 jsPDF
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // --- Header Banner ---
      doc.setFillColor(15, 23, 42); // #0f172a Dark slate
      doc.rect(0, 0, pageWidth, 24, 'F');

      doc.setTextColor(248, 250, 252); // White
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.text('SMART ENERGY METER — TELEMETRY & ELECTRICAL REPORT', 14, 11);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text('Capstone IoT Energy Monitoring, Relay Protection & Diagnostic Telemetry', 14, 18);

      // --- Metadata Grid ---
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);

      const periodStartStr = startTime ? formatIST(startTime) : 'Historical Earliest';
      const periodEndStr = endTime ? formatIST(endTime) : 'Present';
      const generatedAtStr = formatIST(new Date());

      const metaY = 30;
      doc.setFont('helvetica', 'bold');
      doc.text('Device ID:', 14, metaY);
      doc.setFont('helvetica', 'normal');
      doc.text(deviceId, 34, metaY);

      doc.setFont('helvetica', 'bold');
      doc.text('Time Filter:', 80, metaY);
      doc.setFont('helvetica', 'normal');
      doc.text(range.toUpperCase(), 100, metaY);

      doc.setFont('helvetica', 'bold');
      doc.text('Reporting Window:', 130, metaY);
      doc.setFont('helvetica', 'normal');
      doc.text(`${periodStartStr}  to  ${periodEndStr}`, 162, metaY);

      doc.setFont('helvetica', 'bold');
      doc.text('Generated At:', 14, metaY + 6);
      doc.setFont('helvetica', 'normal');
      doc.text(generatedAtStr, 36, metaY + 6);

      doc.setFont('helvetica', 'bold');
      doc.text('Total Records:', 80, metaY + 6);
      doc.setFont('helvetica', 'normal');
      doc.text(`${count.toLocaleString()} rows`, 105, metaY + 6);

      // --- Executive Summary Table ---
      const summaryHead = [
        ['Total Energy', 'Est. Cost', 'Peak Power', 'Avg Power', 'Avg Voltage', 'Volt Range (Min-Max)', 'Avg Current', 'Avg Freq', 'Avg PF']
      ];
      const summaryBody = [
        [
          `${totalEnergy.toFixed(3)} kWh`,
          `Rs. ${totalCost.toFixed(2)}`,
          `${peakPower.toFixed(1)} W`,
          `${avgPower.toFixed(1)} W`,
          `${avgVoltage.toFixed(1)} V`,
          `${minVoltage === Infinity ? '0.0' : minVoltage.toFixed(1)} - ${maxVoltage.toFixed(1)} V`,
          `${avgCurrent.toFixed(2)} A`,
          `${avgFreq.toFixed(1)} Hz`,
          `${avgPf.toFixed(2)}`,
        ]
      ];

      autoTable(doc, {
        head: summaryHead,
        body: summaryBody,
        startY: metaY + 11,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 41, 59], // #1e293b
          textColor: [241, 245, 249],
          fontSize: 7.5,
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          fontSize: 8,
          fontStyle: 'bold',
          textColor: [15, 23, 42],
          halign: 'center',
          fillColor: [248, 250, 252],
        },
        margin: { left: 14, right: 14 },
      });

      // --- Detailed Telemetry Data Table ---
      const tableHead = [
        [
          'Timestamp (IST)',
          'Device ID',
          'Voltage (V)',
          'Current (A)',
          'Power (W)',
          'Energy (kWh)',
          'Freq (Hz)',
          'P.F.',
          'Cost (Rs)',
          'Protection Status',
        ]
      ];

      const tableBody = allReadings.map((r) => [
        formatIST(r.timestamp),
        r.device_id,
        Number(r.voltage || 0).toFixed(1),
        Number(r.current_amps || 0).toFixed(3),
        Number(r.power || 0).toFixed(1),
        Number(r.energy_kwh || 0).toFixed(4),
        Number(r.frequency || 0).toFixed(1),
        Number(r.power_factor || 0).toFixed(2),
        Number(r.cost || 0).toFixed(2),
        r.protection_status?.toUpperCase() || 'NORMAL',
      ]);

      const lastTableEnd = (doc as any).lastAutoTable.finalY || 55;

      autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: lastTableEnd + 6,
        theme: 'striped',
        headStyles: {
          fillColor: [51, 65, 85], // Slate 700
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          fontSize: 7,
          textColor: [30, 41, 59],
          halign: 'center',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 42, halign: 'left' },
          1: { cellWidth: 28 },
          9: { cellWidth: 26, fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14, bottom: 15 },
        showHead: 'everyPage',
        didDrawPage: (data: any) => {
          // Footer on every page
          const str = `Page ${data.pageNumber} of ${(doc as any).internal.getNumberOfPages()}`;
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.setFont('helvetica', 'normal');
          doc.text(
            'Smart Energy Meter Capstone • Telemetry Verification Export',
            14,
            pageHeight - 6
          );
          doc.text(str, pageWidth - 14 - doc.getTextWidth(str), pageHeight - 6);
        },
      });

      const pdfArrayBuffer = doc.output('arraybuffer');
      const filename = `energy_telemetry_${safeDeviceName}_${range}_${timestampStr}.pdf`;

      return new Response(pdfArrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({ error: 'Invalid format requested. Supported formats: csv, pdf.' }, { status: 400 });
  } catch (err: any) {
    console.error('[/api/telemetry/export] Fatal export error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error generating telemetry export.' },
      { status: 500 }
    );
  }
}
