'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

// ── Driver Data ─────────────────────────────────────────────────────────────
interface DriverEntry { vehicle: string; name: string; }

const HEAD_OFFICE_DRIVERS: DriverEntry[] = [
  { vehicle: 'GC-5856-20', name: 'DOUGLAS QUAINOO' },
  { vehicle: 'GW-9822-23', name: 'SIMON ABLORH' },
  { vehicle: 'GW-4586-24', name: 'MAXWELL APPIAH' },
  { vehicle: 'GW-9200-22', name: 'DIARI MORO' },
  { vehicle: 'GW-2476-17', name: 'PRINCE AIDOO' },
  { vehicle: 'GW-4416-21', name: 'PATRICK ADARKWAH YIADOM' },
  { vehicle: 'GW-2472-17', name: 'JAMES OFORI' },
  { vehicle: 'GW-2876-14', name: 'ABRAHAM BIOH' },
  { vehicle: 'GT-6873-15', name: 'EUGENE YENDU' },
  { vehicle: 'GN-1554-25', name: 'DANIEL FRIMPONG' },
  { vehicle: 'GN-2094-12', name: 'YAW ASOMANING' },
  { vehicle: 'GR-9200-17', name: 'RANSFORD ANTWI BOASIAKO' },
  { vehicle: 'AS-3318-16', name: 'UNKNOWN DRIVER' },
  { vehicle: 'GN-1015-25', name: 'UNKNOWN DRIVER' },
];

const MF_DRIVERS: DriverEntry[] = [
  { vehicle: 'GW-2478-17', name: 'SOLOMON ABEKAH (GOASO)' },
  { vehicle: 'GW-2474-17', name: 'OKINE ABDULLAI (ELUBO)' },
  { vehicle: 'AS-5830-23', name: 'UNKNOWN DRIVER (BEREKUM)' },
];

const DUNKWA_DRIVERS: DriverEntry[] = [
  { vehicle: 'GW-9753-13', name: 'FRANCIS ACHEAMPONG' },
  { vehicle: 'GT-8733-24', name: 'FRANCIS ACHEAMPONG' },
];

const SINGLE_BRANCHES: Record<string, DriverEntry> = {
  'SEFWI BEKWAI':  { vehicle: 'GW-9424-25', name: 'ALEX TAKYI' },
  'SEFWIDWENASE':  { vehicle: 'GW-9623-25', name: 'PATRICK OSEI' },
  'AKROPONG MAIN': { vehicle: 'GW-4903-17', name: 'ADABO FRANCIS' },
  'AKROPONG HIGH': { vehicle: 'GW-4905-24', name: 'CROSBY LARBI' },
  'BAWDIE':        { vehicle: 'GW-2473-17', name: 'MESHACK BOADI' },
  'TARKWA MAIN':   { vehicle: 'GM-1536-16', name: 'MAWULI GA' },
  'TARKWA TAMSO':  { vehicle: 'GW-6271-17', name: 'RICHARD TAKYI' },
  'PRESTEA':       { vehicle: 'GW-2477-17', name: 'EBENEZER DJANGMAH' },
  'MANSO AMENFI':  { vehicle: 'GW-9600-25', name: 'NELSON ODURO' },
  'ASANKO HIGH':   { vehicle: 'GT-8794-17', name: 'ELVIS BOATENG' },
  'ASANKO MAIN':   { vehicle: 'GT-8431-24', name: 'GEORGE MANTEY' },
  'SAMREBOI':      { vehicle: 'GW-4464-24', name: 'ROBERT NUM' },
  'ENCHI':         { vehicle: 'GW-7920-16', name: 'FRANK OFORI' },
  'DOMINASE':      { vehicle: 'GT-876-16',  name: 'ISAAC BOAFO' },
};

const ALL_BRANCHES = [
  'HEAD OFFICE', 'DUNKWA', 'MICROFINANCE',
  ...Object.keys(SINGLE_BRANCHES).sort(),
];

// Haversine formula — distance between two GPS coords in km
function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type Phase = 'select' | 'clocked_in';

export default function DriversPage() {
  const [branch, setBranch] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<DriverEntry | null>(null);
  const [driverList, setDriverList] = useState<DriverEntry[]>([]);
  const [phase, setPhase] = useState<Phase>('select');
  const [logId, setLogId] = useState<number | null>(null);
  const [clockInTime, setClockInTime] = useState('');
  const [km, setKm] = useState(0);
  const [gpsStatus, setGpsStatus] = useState('Waiting for GPS...');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState('00:00:00');
  const [notes, setNotes] = useState('');

  const lastPos = useRef<{ lat: number; lng: number } | null>(null);
  const startPos = useRef<{ lat: number; lng: number } | null>(null);
  const currentPos = useRef<{ lat: number; lng: number } | null>(null);
  const totalKm = useRef(0);
  const watchId = useRef<number | null>(null);
  const startTime = useRef<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load saved session from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('driver_session');
    if (saved) {
      const s = JSON.parse(saved);
      setPhase('clocked_in');
      setLogId(s.logId);
      setClockInTime(s.clockInTime);
      setSelectedDriver(s.driver);
      setBranch(s.branch);
      totalKm.current = s.km ?? 0;
      setKm(s.km ?? 0);
      startTime.current = new Date(s.startTime);
    }
  }, []);

  // Timer
  useEffect(() => {
    if (phase !== 'clocked_in') return;
    timerRef.current = setInterval(() => {
      if (!startTime.current) return;
      const diff = Math.floor((Date.now() - startTime.current.getTime()) / 1000);
      const h = String(Math.floor(diff / 3600)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
      const s = String(diff % 60).padStart(2, '0');
      setElapsed(`${h}:${m}:${s}`);
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // GPS tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) { setGpsStatus('GPS not supported'); return; }
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsStatus(`GPS: ±${Math.round(accuracy)}m`);
        currentPos.current = { lat: latitude, lng: longitude };

        if (lastPos.current) {
          const dist = haversine(lastPos.current.lat, lastPos.current.lng, latitude, longitude);
          if (dist > 0.01) { // only count if moved >10m
            totalKm.current = parseFloat((totalKm.current + dist).toFixed(3));
            setKm(totalKm.current);
          }
        }
        lastPos.current = { lat: latitude, lng: longitude };
        if (!startPos.current) startPos.current = { lat: latitude, lng: longitude };

        // Save km to localStorage
        const saved = localStorage.getItem('driver_session');
        if (saved) {
          const s = JSON.parse(saved);
          localStorage.setItem('driver_session', JSON.stringify({ ...s, km: totalKm.current }));
        }
      },
      (err) => setGpsStatus(`GPS error: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    if (phase === 'clocked_in') startTracking();
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [phase, startTracking]);

  // Branch selection
  function onBranchChange(b: string) {
    setBranch(b);
    setSelectedDriver(null);
    if (b === 'HEAD OFFICE') setDriverList(HEAD_OFFICE_DRIVERS);
    else if (b === 'MICROFINANCE') setDriverList(MF_DRIVERS);
    else if (b === 'DUNKWA') setDriverList(DUNKWA_DRIVERS);
    else {
      const d = SINGLE_BRANCHES[b];
      if (d) { setSelectedDriver(d); setDriverList([]); }
      else setDriverList([]);
    }
  }

  function onDriverSelect(idx: string) {
    const d = driverList[parseInt(idx)];
    if (d) setSelectedDriver(d);
  }

  async function handleClockIn() {
    if (!selectedDriver || !branch) { setError('Please select branch and driver'); return; }
    setLoading(true); setError('');

    // Get current position
    const getPos = (): Promise<GeolocationPosition | null> =>
      new Promise((res) => {
        if (!navigator.geolocation) { res(null); return; }
        navigator.geolocation.getCurrentPosition(res, () => res(null), { timeout: 8000 });
      });

    const pos = await getPos();
    const lat = pos?.coords.latitude ?? null;
    const lng = pos?.coords.longitude ?? null;

    const resp = await fetch('/api/drivers/clock-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driver_name: selectedDriver.name, vehicle_number: selectedDriver.vehicle, branch, lat, lng }),
    });

    const data = await resp.json();
    if (!resp.ok) { setError(data.error); setLoading(false); return; }

    const now = new Date();
    startTime.current = now;
    totalKm.current = 0;
    setKm(0);
    setLogId(data.id);
    setClockInTime(now.toLocaleTimeString('en-GB'));
    setPhase('clocked_in');

    localStorage.setItem('driver_session', JSON.stringify({
      logId: data.id,
      clockInTime: now.toLocaleTimeString('en-GB'),
      driver: selectedDriver,
      branch,
      km: 0,
      startTime: now.toISOString(),
    }));

    setLoading(false);
  }

  async function handleClockOut() {
    if (!logId) return;
    setLoading(true); setError('');

    const lat = currentPos.current?.lat ?? null;
    const lng = currentPos.current?.lng ?? null;

    const resp = await fetch('/api/drivers/clock-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: logId, lat, lng, km_consumed: totalKm.current, notes }),
    });

    const data = await resp.json();
    if (!resp.ok) { setError(data.error); setLoading(false); return; }

    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    if (timerRef.current) clearInterval(timerRef.current);
    localStorage.removeItem('driver_session');

    // Reset
    setPhase('select');
    setBranch('');
    setSelectedDriver(null);
    setDriverList([]);
    setLogId(null);
    setKm(0);
    setElapsed('00:00:00');
    setNotes('');
    totalKm.current = 0;
    lastPos.current = null;
    startPos.current = null;
    currentPos.current = null;
    setLoading(false);
    alert(`✅ Clocked out. Total distance: ${totalKm.current.toFixed(2)} km`);
  }

  const needsDropdown = ['HEAD OFFICE', 'MICROFINANCE', 'DUNKWA'].includes(branch);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-600">
      <div className="max-w-md mx-auto pt-8 px-4 pb-16">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🚗</div>
          <h1 className="text-3xl font-black text-white tracking-wide">DRIVER LOG</h1>
          <p className="text-green-200 text-sm mt-1">Amenfiman Community Bank</p>
        </div>

        {phase === 'select' ? (
          <div className="bg-white rounded-3xl shadow-2xl p-6 space-y-5">
            <h2 className="text-lg font-bold text-gray-800 text-center">Clock In</h2>

            {/* Branch */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Select Branch</label>
              <select value={branch} onChange={e => onBranchChange(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-black font-semibold focus:outline-none focus:border-green-500 bg-white">
                <option value="">— Choose Branch —</option>
                {ALL_BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* Driver dropdown (HO / MF / Dunkwa) */}
            {needsDropdown && driverList.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Select Driver</label>
                <select onChange={e => onDriverSelect(e.target.value)} defaultValue=""
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-black font-semibold focus:outline-none focus:border-green-500 bg-white">
                  <option value="">— Choose Driver —</option>
                  {driverList.map((d, i) => (
                    <option key={i} value={i}>{d.name} — {d.vehicle}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Auto-populated info */}
            {selectedDriver && (
              <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👤</span>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Driver</p>
                    <p className="font-black text-gray-900 text-base">{selectedDriver.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🚗</span>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Vehicle Number</p>
                    <p className="font-black text-green-800 text-lg tracking-widest">{selectedDriver.vehicle}</p>
                  </div>
                </div>
              </div>
            )}

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button onClick={handleClockIn} disabled={!selectedDriver || loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-black py-4 rounded-2xl text-lg transition-all shadow-lg disabled:shadow-none">
              {loading ? 'Clocking In...' : '🟢 CLOCK IN'}
            </button>

            <div className="text-center">
              <a href="/drivers/report" className="text-green-600 font-semibold text-sm hover:underline">
                📊 View Driver Reports →
              </a>
            </div>
          </div>

        ) : (
          /* ── CLOCKED IN VIEW ── */
          <div className="space-y-4">

            {/* Status card */}
            <div className="bg-white rounded-3xl shadow-2xl p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Driver</p>
                  <p className="font-black text-gray-900 text-base">{selectedDriver?.name}</p>
                  <p className="text-green-700 font-bold text-sm">{selectedDriver?.vehicle}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{branch}</p>
                </div>
                <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                  🟢 ON DUTY
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-blue-50 rounded-2xl p-4 text-center">
                  <p className="text-xs text-blue-500 uppercase tracking-wide font-semibold">Clocked In</p>
                  <p className="text-xl font-black text-blue-800 mt-1">{clockInTime}</p>
                </div>
                <div className="bg-purple-50 rounded-2xl p-4 text-center">
                  <p className="text-xs text-purple-500 uppercase tracking-wide font-semibold">Duration</p>
                  <p className="text-xl font-black text-purple-800 mt-1 font-mono">{elapsed}</p>
                </div>
              </div>

              {/* KM counter */}
              <div className="bg-gradient-to-r from-green-600 to-emerald-500 rounded-2xl p-5 text-center text-white mb-4">
                <p className="text-green-200 text-xs uppercase tracking-widest font-semibold">Distance Travelled</p>
                <p className="text-5xl font-black mt-1">{km.toFixed(2)}</p>
                <p className="text-green-200 text-sm font-semibold">kilometres</p>
                <p className="text-green-300 text-xs mt-2">{gpsStatus}</p>
              </div>

              {/* Notes */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Notes (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  placeholder="e.g. Carried documents to branch..."
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm text-black focus:outline-none focus:border-green-500 resize-none" />
              </div>

              {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}

              <button onClick={handleClockOut} disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-black py-4 rounded-2xl text-lg transition-all shadow-lg">
                {loading ? 'Clocking Out...' : '🔴 CLOCK OUT'}
              </button>
            </div>

            <div className="text-center">
              <a href="/drivers/report" className="text-white font-semibold text-sm hover:underline opacity-80">
                📊 View Driver Reports →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
