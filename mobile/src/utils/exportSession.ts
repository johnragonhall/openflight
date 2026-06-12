import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Shot } from '../types/shot';

function csvField(v: string | number | null | undefined): string {
  const s = String(v ?? '');
  // Prefix spreadsheet formula-injection characters to prevent execution in Excel/Sheets
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  // Wrap in quotes if the value contains commas, quotes, or newlines
  return /[,"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function exportSessionCSV(shots: Shot[]): Promise<void> {
  if (shots.length === 0) throw new Error('No shots to export');

  const headers = [
    'timestamp', 'club', 'ball_speed_mph', 'estimated_carry_yards',
    'club_speed_mph', 'smash_factor', 'launch_angle_vertical',
    'spin_rpm', 'carry_spin_adjusted',
  ].join(',');

  const rows = shots.map((s) =>
    [
      s.timestamp,
      s.club,
      s.ball_speed_mph,
      s.estimated_carry_yards,
      s.club_speed_mph ?? '',
      s.smash_factor ?? '',
      s.launch_angle_vertical ?? '',
      s.spin_rpm ?? '',
      s.carry_spin_adjusted ?? '',
    ].map(csvField).join(',')
  );

  const csv = [headers, ...rows].join('\n');
  const tag = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `openflight_${tag}.csv`;
  const dir = FileSystem.documentDirectory;
  if (!dir) throw new Error('Cannot access device storage');
  const path = `${dir}${filename}`;

  await FileSystem.writeAsStringAsync(path, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing not available on this device');

  await Sharing.shareAsync(path, {
    mimeType: 'text/csv',
    dialogTitle: 'Export Session',
    UTI: 'public.comma-separated-values-text',
  });
}
