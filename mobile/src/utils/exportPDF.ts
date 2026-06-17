import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Shot } from '../types/shot';

function h(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function row(shot: Shot, i: number): string {
  const carry = (shot.carry_spin_adjusted ?? shot.estimated_carry_yards).toFixed(0);
  const spin = shot.spin_rpm !== null ? Math.round(shot.spin_rpm).toLocaleString() : '—';
  const launch = shot.launch_angle_vertical !== null ? shot.launch_angle_vertical.toFixed(1) + '°' : '—';
  const club = shot.club_speed_mph !== null ? shot.club_speed_mph.toFixed(1) : '—';
  const smash = shot.smash_factor !== null ? shot.smash_factor.toFixed(2) : '—';
  const time = new Date(shot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `<tr>
    <td>${i + 1}</td><td>${h(time)}</td><td>${h(shot.club.toUpperCase())}</td>
    <td>${h(shot.ball_speed_mph.toFixed(1))}</td><td>${h(club)}</td><td>${h(smash)}</td>
    <td>${h(carry)}</td><td>${h(launch)}</td><td>${h(spin)}</td>
  </tr>`;
}

function buildHtml(shots: Shot[]): string {
  const date = new Date().toLocaleDateString();
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body { font-family: Arial, sans-serif; padding: 20px; background: #fff; color: #111; }
  h1 { color: #16a34a; font-size: 22px; margin-bottom: 4px; }
  p { color: #6b7280; margin: 0 0 16px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #16a34a; color: #fff; padding: 8px 6px; text-align: left; }
  td { padding: 6px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
</style></head><body>
<h1>OpenFlight Session Report</h1>
<p>${date} · ${shots.length} shots</p>
<table>
  <tr><th>#</th><th>Time</th><th>Club</th><th>Ball (mph)</th><th>Club (mph)</th>
      <th>Smash</th><th>Carry (yds)</th><th>Launch</th><th>Spin (rpm)</th></tr>
  ${shots.map(row).join('')}
</table>
</body></html>`;
}

export async function exportSessionPDF(shots: Shot[]): Promise<void> {
  if (shots.length === 0) throw new Error('No shots to export');
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing not available on this device');
  const { uri } = await Print.printToFileAsync({ html: buildHtml(shots) });
  await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
}
