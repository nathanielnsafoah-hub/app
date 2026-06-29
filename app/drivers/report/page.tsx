'use client';
import { useState, useEffect } from 'react';

interface Log {
  id: number;
  driver_name: string;
  vehicle_number: string;
  branch: string;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_out_lat: number | null;
  clock_out_lng: number | null;
  km_consumed: number;
  status: string;
  notes: string | null;
}

const BRANCHES_FILTER = [
  'ALL', 'HEAD OFFICE', 'DUNKWA', 'MICROFINANCE',
  'SEFWI BEKWAI', 'SEFWIDWENASE', 'AKROPONG MAIN', 'AKROPONG HIGH',
  'BAWDIE', 'TARKWA MAIN', 'TARKWA TAMSO', 'PRESTEA', 'MANSO AMENFI',
  'ASANKO HIGH', 'ASANKO MAIN', 'SAMREBOI', 'ENCHI', 'DOMINASE',
];

function formatTime(dt: string | null) {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dt: string | null) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function duration(inTime: string, outTime: string | null) {
  if (!outTime) return 'On duty';
  const diff = Math.floor((new Date(outTime).getTime() - new Date(inTime).getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function DriverReport() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [branch, setBranch] = useState('ALL');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ date, branch });
    fetch(`/api/drivers/report?${params}`)
      .then(r => r.json())
      .then(d => { setLogs(d.logs ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [date, branch]);

  const totalKm = logs.reduce((s, l) => s + (Number(l.km_consumed) || 0), 0);
  const onDuty = logs.filter(l => l.status === 'clocked_in').length;
  const completed = logs.filter(l => l.status === 'clocked_out').length;

  function mapsLink(lat: number | null, lng: number | null) {
    if (!lat || !lng) return null;
    return `https://maps.google.com/?q=${lat},${lng}`;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-green-800 text-white px-6 py-5">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black tracking-wide">🚗 Driver Report</h1>
            <p className="text-green-300 text-sm">Amenfiman Community Bank — Vehicle Log</p>
          </div>
          <a href="/drivers" className="bg-white text-green-800 font-bold px-4 py-2 rounded-xl text-sm hover:bg-green-50">
            ← Clock In/Out
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="border-2 border-gray-200 rounded-xl px-4 py-2.5 text-black font-semibold focus:outline-none focus:border-green-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Branch</label>
            <select value={branch} onChange={e => setBranch(e.target.value)}
              className="border-2 border-gray-200 rounded-xl px-4 py-2.5 text-black font-semibold focus:outline-none focus:border-green-500 bg-white">
              {BRANCHES_FILTER.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <button onClick={() => window.print()}
            className="bg-green-700 hover:bg-green-800 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">
            🖨 Print Report
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Trips</p>
            <p className="text-3xl font-black text-gray-900 mt-1">{logs.length}</p>
          </div>
          <div className="bg-green-50 rounded-2xl shadow-sm border border-green-200 p-4 text-center">
            <p className="text-xs text-green-600 uppercase tracking-wide font-semibold">On Duty Now</p>
            <p className="text-3xl font-black text-green-800 mt-1">{onDuty}</p>
          </div>
          <div className="bg-blue-50 rounded-2xl shadow-sm border border-blue-200 p-4 text-center">
            <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Completed</p>
            <p className="text-3xl font-black text-blue-800 mt-1">{completed}</p>
          </div>
          <div className="bg-purple-50 rounded-2xl shadow-sm border border-purple-200 p-4 text-center">
            <p className="text-xs text-purple-600 uppercase tracking-wide font-semibold">Total KM</p>
            <p className="text-3xl font-black text-purple-800 mt-1">{totalKm.toFixed(1)}</p>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <p className="text-center text-gray-400 py-12">Loading...</p>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-4xl mb-3">🚗</p>
            <p className="text-gray-400 font-medium">No driver logs for this date</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-green-50 text-green-800 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Driver</th>
                    <th className="px-4 py-3 text-left">Vehicle</th>
                    <th className="px-4 py-3 text-left">Branch</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Clock In</th>
                    <th className="px-4 py-3 text-left">Clock Out</th>
                    <th className="px-4 py-3 text-left">Duration</th>
                    <th className="px-4 py-3 text-right">KM</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-left">Location</th>
                    <th className="px-4 py-3 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-gray-900">{log.driver_name}</td>
                      <td className="px-4 py-3 font-mono text-green-700 font-semibold">{log.vehicle_number}</td>
                      <td className="px-4 py-3 text-gray-600">{log.branch}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(log.clock_in_time)}</td>
                      <td className="px-4 py-3 text-gray-700">{formatTime(log.clock_in_time)}</td>
                      <td className="px-4 py-3 text-gray-700">{formatTime(log.clock_out_time)}</td>
                      <td className="px-4 py-3 text-gray-600">{duration(log.clock_in_time, log.clock_out_time)}</td>
                      <td className="px-4 py-3 text-right font-black text-purple-700">
                        {Number(log.km_consumed).toFixed(2)} km
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          log.status === 'clocked_in' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {log.status === 'clocked_in' ? '🟢 On Duty' : '✅ Done'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {mapsLink(log.clock_in_lat, log.clock_in_lng) && (
                            <a href={mapsLink(log.clock_in_lat, log.clock_in_lng)!} target="_blank" rel="noopener noreferrer"
                              className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded hover:bg-blue-100">In📍</a>
                          )}
                          {mapsLink(log.clock_out_lat, log.clock_out_lng) && (
                            <a href={mapsLink(log.clock_out_lat, log.clock_out_lng)!} target="_blank" rel="noopener noreferrer"
                              className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded hover:bg-red-100">Out📍</a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-32 truncate">{log.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-green-50">
                  <tr>
                    <td colSpan={7} className="px-4 py-3 font-bold text-green-800 text-sm">TOTAL</td>
                    <td className="px-4 py-3 text-right font-black text-purple-800">{totalKm.toFixed(2)} km</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
