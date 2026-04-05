import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Building2, Plus, Search, Edit2, Power, MapPin, Users,
  X, AlertCircle, CheckCircle, ChevronDown, Loader2, Filter, Navigation, Info, Target,
} from 'lucide-react';
import apiClient from '../../api/axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const RADIUS_MIN     = 10;
const RADIUS_MAX     = 1000;
const RADIUS_DEFAULT = 100;

// ── Utility Components ────────────────────────────────────────────────────────

const StatusBadge = ({ isActive }) =>
  isActive ? (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
      style={{
        backgroundColor: `rgb(var(--primary-50))`,
        color: `rgb(var(--primary-700))`,
        borderColor: `rgb(var(--primary-200))`,
      }}
    >
      <CheckCircle className="w-3 h-3" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
      <AlertCircle className="w-3 h-3" /> Inactive
    </span>
  );

const LocationBadge = ({ hasCoords, radiusMeters }) =>
  hasCoords ? (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100 whitespace-nowrap"
      title={radiusMeters ? `Geofence radius: ${radiusMeters}m` : 'GPS location set'}
    >
      <Target className="w-2.5 h-2.5 shrink-0" />
      {radiusMeters ? `${radiusMeters}m` : 'Located'}
    </span>
  ) : null;

const EmptyState = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-3">
    <div
      className="w-16 h-16 rounded-full flex items-center justify-center"
      style={{ backgroundColor: `rgb(var(--primary-50))` }}
    >
      <Building2 className="w-8 h-8" style={{ color: `rgb(var(--primary-300))` }} />
    </div>
    <p className="text-base font-semibold" style={{ color: `rgb(var(--primary-800))` }}>{message}</p>
  </div>
);

const Tooltip = ({ text, children }) => (
  <span className="group relative">
    {children}
    {text && (
      <span
        className="pointer-events-none absolute bottom-full left-0 mb-1.5 z-50 hidden group-hover:block w-max max-w-xs text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg leading-snug"
        style={{ backgroundColor: `rgb(var(--primary-900))` }}
      >
        {text}
        <span
          className="absolute top-full left-3 border-4 border-transparent"
          style={{ borderTopColor: `rgb(var(--primary-900))` }}
        />
      </span>
    )}
  </span>
);

// ── RadiusInput ───────────────────────────────────────────────────────────────

const RadiusInput = ({ value, onChange, error }) => {
  const [draft, setDraft] = useState(String(value ?? RADIUS_DEFAULT));

  useEffect(() => {
    setDraft(String(value ?? RADIUS_DEFAULT));
  }, [value]);

  const numericDraft = Number(draft);
  const clampedValue = isNaN(numericDraft)
    ? RADIUS_MIN
    : Math.min(Math.max(numericDraft, RADIUS_MIN), RADIUS_MAX);

  const pct = ((clampedValue - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN)) * 100;

  const handleNumberChange = (e) => {
    const raw = e.target.value;
    setDraft(raw);
    const num = Number(raw);
    if (!isNaN(num) && raw.trim() !== '') onChange(num);
  };

  const handleSliderChange = (e) => {
    const num = Number(e.target.value);
    setDraft(String(num));
    onChange(num);
  };

  const handleBlur = () => {
    const num     = Number(draft);
    const clamped = isNaN(num)
      ? RADIUS_DEFAULT
      : Math.min(Math.max(Math.round(num), RADIUS_MIN), RADIUS_MAX);
    setDraft(String(clamped));
    onChange(clamped);
  };

  const ticks = [
    { label: `${RADIUS_MIN}m`, pct: 0 },
    { label: '250m',           pct: ((250 - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN)) * 100 },
    { label: '500m',           pct: ((500 - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN)) * 100 },
    { label: `${RADIUS_MAX}m`, pct: 100 },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label
          htmlFor="radius-number-input"
          className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"
          style={{ color: `rgb(var(--primary-700))` }}
        >
          <Target className="w-3.5 h-3.5" style={{ color: `rgb(var(--primary-500))` }} aria-hidden="true" />
          Geofence Radius
        </label>

        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded-full border"
            style={
              error
                ? { borderColor: '#fca5a5', backgroundColor: '#fef2f2', color: '#ef4444' }
                : { borderColor: `rgb(var(--primary-200))`, backgroundColor: `rgb(var(--primary-50))`, color: `rgb(var(--primary-600))` }
            }
            aria-live="polite"
            aria-atomic="true"
          >
            {clampedValue} m
          </span>

          <input
            id="radius-number-input"
            type="number"
            min={RADIUS_MIN}
            max={RADIUS_MAX}
            value={draft}
            onChange={handleNumberChange}
            onBlur={handleBlur}
            aria-label={`Geofence radius in meters, between ${RADIUS_MIN} and ${RADIUS_MAX}`}
            aria-describedby="radius-helper-text"
            aria-invalid={!!error}
            className="w-20 text-center px-2 py-1 rounded-lg text-sm font-bold transition-all outline-none"
            style={
              error
                ? { border: '1px solid #fca5a5', color: '#ef4444', backgroundColor: '#fef2f2' }
                : { border: `1px solid rgb(var(--primary-200))`, backgroundColor: 'white', color: `rgb(var(--primary-700))` }
            }
            onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-200))`; e.target.style.borderColor = `rgb(var(--primary-400))`; }}
            onBlur2={e => { e.target.style.boxShadow = 'none'; }}
          />
          <span className="text-xs font-medium" style={{ color: `rgb(var(--primary-500))` }}>m</span>
        </div>
      </div>

      <div className="w-full mt-2">
        <div className="relative w-full h-5 flex items-center" role="presentation">
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: `rgb(var(--primary-100))` }}
            aria-hidden="true"
          >
            <div
              className="h-full rounded-full transition-all duration-150"
              style={{
                width: `${pct}%`,
                background: `linear-gradient(to right, rgb(var(--primary-300)), rgb(var(--primary-500)), rgb(var(--primary-700)))`,
              }}
            />
          </div>
          <input
            type="range"
            min={RADIUS_MIN}
            max={RADIUS_MAX}
            step={5}
            value={clampedValue}
            onChange={handleSliderChange}
            aria-label={`Geofence radius slider, ${clampedValue} meters`}
            className="absolute inset-0 w-full opacity-0 cursor-pointer h-5"
          />
          <div
            aria-hidden="true"
            className="absolute w-4 h-4 rounded-full bg-white shadow-md pointer-events-none transition-all duration-150"
            style={{
              left: `calc(${pct}% - 8px)`,
              border: `2px solid rgb(var(--primary-500))`,
            }}
          />
        </div>

        <div className="relative w-full h-4 mt-1" aria-hidden="true">
          {ticks.map(({ label, pct: tickPct }) => (
            <span
              key={label}
              className="absolute text-[10px] font-medium -translate-x-1/2"
              style={{ left: `${tickPct}%`, color: `rgb(var(--primary-400))` }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {error ? (
        <p id="radius-helper-text" role="alert" className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" /> {error}
        </p>
      ) : (
        <p
          id="radius-helper-text"
          className="text-xs flex items-start gap-1.5 leading-relaxed"
          style={{ color: `rgb(var(--primary-400))` }}
        >
          <Info className="w-3 h-3 shrink-0 mt-0.5" style={{ color: `rgb(var(--primary-400))` }} aria-hidden="true" />
          This radius defines the allowed GPS area around the company. Students must be inside
          this radius for their attendance location to be marked as{' '}
          <span className="font-semibold" style={{ color: `rgb(var(--primary-600))` }}>Verified</span>.
        </p>
      )}
    </div>
  );
};

// ── LeafletLocationPicker ─────────────────────────────────────────────────────

const LeafletLocationPicker = ({ latitude, longitude, radius, onLocationChange }) => {
  const mapRef        = useRef(null);
  const leafletMapRef = useRef(null);
  const markerRef     = useRef(null);
  const circleRef     = useRef(null);
  const radiusRef     = useRef(radius);

  const [searchQuery, setSearchQuery] = useState('');
  const [searching,   setSearching]   = useState(false);
  const [searchError, setSearchError] = useState('');

  const defaultCenter = [14.5995, 120.9842];
  const initialCenter = latitude && longitude
    ? [parseFloat(latitude), parseFloat(longitude)]
    : defaultCenter;

  const upsertCircle = useCallback((map, lat, lng, r) => {
    const parsed     = parseInt(r, 10);
    const safeRadius = isNaN(parsed) || parsed < RADIUS_MIN ? RADIUS_DEFAULT : parsed;
    if (circleRef.current) {
      circleRef.current.setLatLng([lat, lng]);
      circleRef.current.setRadius(safeRadius);
    } else {
      circleRef.current = L.circle([lat, lng], {
        radius: safeRadius, color: '#16a34a', fillColor: '#bbf7d0',
        fillOpacity: 0.25, weight: 2, dashArray: '6 4',
      }).addTo(map);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;
    const map = L.map(mapRef.current, { center: initialCenter, zoom: latitude && longitude ? 15 : 6, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      markerRef.current = L.marker([lat, lng]).addTo(map);
      upsertCircle(map, lat, lng, radiusRef.current);
    }
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      if (markerRef.current) { markerRef.current.setLatLng([lat, lng]); }
      else { markerRef.current = L.marker([lat, lng]).addTo(map); }
      upsertCircle(map, lat, lng, radiusRef.current);
      onLocationChange({ latitude: lat.toFixed(6), longitude: lng.toFixed(6) });
    });
    leafletMapRef.current = map;
    return () => {
      map.remove();
      leafletMapRef.current = null;
      markerRef.current     = null;
      circleRef.current     = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!leafletMapRef.current || !latitude || !longitude) return;
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) return;
    if (markerRef.current) { markerRef.current.setLatLng([lat, lng]); }
    else { markerRef.current = L.marker([lat, lng]).addTo(leafletMapRef.current); }
    upsertCircle(leafletMapRef.current, lat, lng, radiusRef.current);
    leafletMapRef.current.setView([lat, lng], 15);
  }, [latitude, longitude, upsertCircle]);

  useEffect(() => {
    radiusRef.current = radius;
    if (!circleRef.current) return;
    const parsed     = parseInt(radius, 10);
    const safeRadius = isNaN(parsed) || parsed < RADIUS_MIN ? RADIUS_DEFAULT : parsed;
    circleRef.current.setRadius(safeRadius);
  }, [radius]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError('');
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const latNum = parseFloat(lat);
        const lngNum = parseFloat(lon);
        if (markerRef.current) { markerRef.current.setLatLng([latNum, lngNum]); }
        else { markerRef.current = L.marker([latNum, lngNum]).addTo(leafletMapRef.current); }
        leafletMapRef.current.setView([latNum, lngNum], 15);
        upsertCircle(leafletMapRef.current, latNum, lngNum, radiusRef.current);
        onLocationChange({ latitude: latNum.toFixed(6), longitude: lngNum.toFixed(6), location_name: display_name });
      } else {
        setSearchError('No results found. Try a different search term.');
      }
    } catch {
      setSearchError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: `rgb(var(--primary-400))` }}
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search for an address or place…"
            aria-label="Search for company address"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm outline-none transition-all"
            style={{
              border: `1px solid rgb(var(--primary-200))`,
              backgroundColor: `rgb(var(--primary-50))`,
              color: `rgb(var(--primary-900))`,
            }}
            onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-200))`; e.target.style.borderColor = `rgb(var(--primary-400))`; }}
            onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          aria-label="Search address"
          className="px-4 py-2.5 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: `rgb(var(--primary-600))` }}
          onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`; }}
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </button>
      </div>
      {searchError && (
        <p role="alert" className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" aria-hidden="true" /> {searchError}
        </p>
      )}
      <div
        ref={mapRef}
        className="w-full rounded-xl shadow-sm"
        style={{ height: '280px', zIndex: 0, border: `2px solid rgb(var(--primary-100))` }}
        aria-label="Map — click to set company location"
        role="application"
      />
      {latitude && longitude ? (
        <div
          className="flex items-center gap-3 px-3 py-2 rounded-lg"
          style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))` }}
        >
          <Navigation className="w-4 h-4 shrink-0" style={{ color: `rgb(var(--primary-500))` }} aria-hidden="true" />
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs font-mono" style={{ color: `rgb(var(--primary-700))` }}>
            <span>Lat: <strong>{parseFloat(latitude).toFixed(6)}</strong></span>
            <span>Lng: <strong>{parseFloat(longitude).toFixed(6)}</strong></span>
          </div>
          <span className="ml-auto text-[10px] italic" style={{ color: `rgb(var(--primary-400))` }}>Click map to adjust</span>
        </div>
      ) : (
        <p className="text-xs flex items-center gap-1.5" style={{ color: `rgb(var(--primary-400))` }}>
          <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
          Search or click on the map to set company location
        </p>
      )}
    </div>
  );
};

// ── ModalField ────────────────────────────────────────────────────────────────

const ModalField = ({ label, id, icon: Icon, error: fieldErr, children }) => (
  <div className="flex flex-col gap-1.5">
    <label
      htmlFor={id}
      className="text-xs font-semibold uppercase tracking-wide"
      style={{ color: `rgb(var(--primary-700))` }}
    >
      {label}
    </label>
    <div className="relative">
      {Icon && (
        <Icon
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
          style={{ color: `rgb(var(--primary-400))` }}
          aria-hidden="true"
        />
      )}
      {children}
    </div>
    {fieldErr && (
      <p role="alert" className="text-xs text-red-500 flex items-center gap-1">
        <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
        {fieldErr}
      </p>
    )}
  </div>
);

const modalInputCls = (hasIcon) =>
  `w-full ${hasIcon ? 'pl-9' : 'px-3.5'} pr-3.5 py-2.5 rounded-lg text-sm outline-none transition-all duration-150`;

// ── CompanyModal ──────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  company_name : '',
  address      : '',
  latitude     : '',
  longitude    : '',
  location_name: '',
  radius_meters: RADIUS_DEFAULT,
};

const CompanyModal = ({ isOpen, onClose, company, onSave }) => {
  const [formData,    setFormData]    = useState(EMPTY_FORM);
  const [loading,     setLoading]     = useState(false);
  const [errors,      setErrors]      = useState({});
  const [submitError, setSubmitError] = useState('');
  const isEdit = !!company;

  useEffect(() => {
    if (!isOpen) return;
    if (company) {
      setFormData({
        company_name : company.company_name  ?? '',
        address      : company.address       ?? '',
        latitude     : company.latitude      ?? '',
        longitude    : company.longitude     ?? '',
        location_name: company.location_name ?? company.company_name ?? '',
        radius_meters: Number(company.radius_meters) || RADIUS_DEFAULT,
      });
    } else {
      setFormData(EMPTY_FORM);
    }
    setErrors({});
    setSubmitError('');
  }, [company, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const set = useCallback((field, val) => {
    setFormData((p) => ({ ...p, [field]: val }));
    setErrors((p)  => ({ ...p, [field]: undefined }));
  }, []);

  const handleLocationChange = useCallback(({ latitude, longitude, location_name }) => {
    setFormData((p) => ({
      ...p,
      latitude     : latitude      ?? p.latitude,
      longitude    : longitude     ?? p.longitude,
      location_name: location_name ?? p.location_name,
    }));
  }, []);

  const handleRadiusChange = useCallback((num) => { set('radius_meters', num); }, [set]);

  const validate = () => {
    const e = {};
    if (!formData.company_name.trim()) e.company_name = 'Company name is required';
    if (!formData.address.trim())      e.address      = 'Address is required';
    const r = Number(formData.radius_meters);
    if (isNaN(r) || r < RADIUS_MIN || r > RADIUS_MAX) {
      e.radius_meters = `Radius must be between ${RADIUS_MIN} and ${RADIUS_MAX} meters`;
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }
    setLoading(true);
    try {
      const payload = {
        company_name : formData.company_name,
        address      : formData.address,
        latitude     : formData.latitude  ? parseFloat(formData.latitude)  : null,
        longitude    : formData.longitude ? parseFloat(formData.longitude) : null,
        location_name: formData.location_name || formData.company_name,
        radius_meters: Number(formData.radius_meters) || RADIUS_DEFAULT,
      };
      if (isEdit) { await apiClient.put(`/companies/${company.company_id}`, payload); }
      else        { await apiClient.post('/companies', payload); }
      onSave();
      onClose();
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit Company' : 'Add New Company'}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8"
        style={{ border: `1px solid rgb(var(--primary-100))`, animation: 'modalIn 0.2s ease-out forwards' }}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between px-6 pt-6 pb-4"
          style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `rgb(var(--primary-50))` }}
            >
              {isEdit
                ? <Edit2 className="w-5 h-5" style={{ color: `rgb(var(--primary-600))` }} />
                : <Plus className="w-5 h-5" style={{ color: `rgb(var(--primary-600))` }} />
              }
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: `rgb(var(--primary-900))` }}>
                {isEdit ? 'Edit Company' : 'Add New Company'}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: `rgb(var(--primary-500))` }}>
                {isEdit ? 'Update company information' : 'Register a new partner company'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150"
            style={{ color: `rgb(var(--primary-400))` }}
            onMouseEnter={e => { e.currentTarget.style.color = `rgb(var(--primary-700))`; e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`; }}
            onMouseLeave={e => { e.currentTarget.style.color = `rgb(var(--primary-400))`; e.currentTarget.style.backgroundColor = ''; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-5 space-y-6">
            {submitError && (
              <div role="alert" className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" aria-hidden="true" />
                <p className="text-sm text-red-600">{submitError}</p>
              </div>
            )}

            {/* Company Information */}
            <section aria-label="Company information">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4" style={{ color: `rgb(var(--primary-500))` }} aria-hidden="true" />
                <h3
                  className="text-sm font-bold uppercase tracking-wide"
                  style={{ color: `rgb(var(--primary-700))` }}
                >
                  Company Information
                </h3>
              </div>
              <div
                className="rounded-xl p-4 space-y-4"
                style={{
                  backgroundColor: `rgb(var(--primary-50) / 0.4)`,
                  border: `1px solid rgb(var(--primary-100))`,
                }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ModalField label="Company Name" id="company_name" error={errors.company_name}>
                    <input
                      id="company_name"
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => set('company_name', e.target.value)}
                      placeholder="e.g., Acme Corporation"
                      autoComplete="organization"
                      className={modalInputCls(false)}
                      style={{
                        border: errors.company_name ? '1px solid #fca5a5' : `1px solid rgb(var(--primary-200))`,
                        color: `rgb(var(--primary-800))`,
                        backgroundColor: 'white',
                      }}
                      onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-200))`; e.target.style.borderColor = `rgb(var(--primary-400))`; }}
                      onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = errors.company_name ? '#fca5a5' : `rgb(var(--primary-200))`; }}
                    />
                  </ModalField>
                  <ModalField label="Address" id="address" error={errors.address}>
                    <input
                      id="address"
                      type="text"
                      value={formData.address}
                      onChange={(e) => set('address', e.target.value)}
                      placeholder="e.g., 123 Main St, City"
                      autoComplete="street-address"
                      className={modalInputCls(false)}
                      style={{
                        border: errors.address ? '1px solid #fca5a5' : `1px solid rgb(var(--primary-200))`,
                        color: `rgb(var(--primary-800))`,
                        backgroundColor: 'white',
                      }}
                      onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-200))`; e.target.style.borderColor = `rgb(var(--primary-400))`; }}
                      onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = errors.address ? '#fca5a5' : `rgb(var(--primary-200))`; }}
                    />
                  </ModalField>
                </div>
              </div>
            </section>

            {/* Location & Geofence */}
            <section aria-label="Location and geofence settings">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4" style={{ color: `rgb(var(--primary-500))` }} aria-hidden="true" />
                <h3
                  className="text-sm font-bold uppercase tracking-wide"
                  style={{ color: `rgb(var(--primary-700))` }}
                >
                  Location & Geofence
                </h3>
              </div>
              <div
                className="rounded-xl p-4 space-y-5"
                style={{
                  backgroundColor: `rgb(var(--primary-50) / 0.4)`,
                  border: `1px solid rgb(var(--primary-100))`,
                }}
              >
                <LeafletLocationPicker
                  latitude={formData.latitude}
                  longitude={formData.longitude}
                  radius={formData.radius_meters}
                  onLocationChange={handleLocationChange}
                />
                <div style={{ borderTop: `1px solid rgb(var(--primary-100))` }} />
                <RadiusInput
                  value={formData.radius_meters}
                  onChange={handleRadiusChange}
                  error={errors.radius_meters}
                />
              </div>
            </section>
          </div>

          {/* Footer actions */}
          <div
            className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 px-6 py-4 rounded-b-2xl"
            style={{
              borderTop: `1px solid rgb(var(--primary-50))`,
              backgroundColor: `rgb(var(--primary-50) / 0.3)`,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-150"
              style={{
                border: `1px solid rgb(var(--primary-200))`,
                color: `rgb(var(--primary-700))`,
                backgroundColor: 'white',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-100))`}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: `rgb(var(--primary-600))` }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`; }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {isEdit ? 'Save Changes' : 'Create Company'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── ConfirmToggleModal ────────────────────────────────────────────────────────

const ConfirmToggleModal = ({ isOpen, onClose, company, onConfirm, loading }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen || !company) return null;
  const isDeactivating = company.is_active;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
        style={{ border: `1px solid rgb(var(--primary-100))`, animation: 'modalIn 0.2s ease-out forwards' }}
      >
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${isDeactivating ? 'bg-red-50' : ''}`}
          style={!isDeactivating ? { backgroundColor: `rgb(var(--primary-50))` } : {}}>
          <Power className={`w-7 h-7 ${isDeactivating ? 'text-red-500' : ''}`}
            style={!isDeactivating ? { color: `rgb(var(--primary-500))` } : {}}
            aria-hidden="true"
          />
        </div>
        <h3 className="text-lg font-bold text-center mb-1" style={{ color: `rgb(var(--primary-900))` }}>
          {isDeactivating ? 'Deactivate Company' : 'Activate Company'}
        </h3>
        <p className="text-sm text-center mb-6" style={{ color: `rgb(var(--primary-600))` }}>
          Are you sure you want to {isDeactivating ? 'deactivate' : 'activate'}{' '}
          <span className="font-semibold" style={{ color: `rgb(var(--primary-800))` }}>{company.company_name}</span>?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            style={{
              border: `1px solid rgb(var(--primary-200))`,
              color: `rgb(var(--primary-700))`,
              backgroundColor: 'white',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              isDeactivating ? 'bg-red-500 hover:bg-red-600' : ''
            }`}
            style={!isDeactivating ? { backgroundColor: `rgb(var(--primary-600))` } : {}}
            onMouseEnter={e => { if (!isDeactivating && !e.currentTarget.disabled) e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`; }}
            onMouseLeave={e => { if (!isDeactivating) e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`; }}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {isDeactivating ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── CoordinatorCompanies (main) ───────────────────────────────────────────────

const CoordinatorCompanies = () => {
  const [companies,          setCompanies]          = useState([]);
  const [filteredCompanies,  setFilteredCompanies]  = useState([]);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState('');
  const [searchTerm,         setSearchTerm]         = useState('');
  const [filterStatus,       setFilterStatus]       = useState('all');
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isEditModalOpen,    setIsEditModalOpen]    = useState(false);
  const [isToggleModalOpen,  setIsToggleModalOpen]  = useState(false);
  const [selectedCompany,    setSelectedCompany]    = useState(null);
  const [toggleLoading,      setToggleLoading]      = useState(false);

  const stats = {
    total   : companies.length,
    active  : companies.filter((c) =>  c.is_active).length,
    inactive: companies.filter((c) => !c.is_active).length,
  };

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const res = await apiClient.get('/companies');
      setCompanies(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  useEffect(() => {
    let result = [...companies];
    if (filterStatus === 'active')   result = result.filter((c) =>  c.is_active);
    if (filterStatus === 'inactive') result = result.filter((c) => !c.is_active);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter((c) =>
        c.company_name?.toLowerCase().includes(s) ||
        c.address?.toLowerCase().includes(s)
      );
    }
    setFilteredCompanies(result);
  }, [companies, searchTerm, filterStatus]);

  const handleToggleStatus = async () => {
    if (!selectedCompany) return;
    setToggleLoading(true);
    try {
      await apiClient.patch(`/companies/${selectedCompany.company_id}/status`, {
        is_active: !selectedCompany.is_active,
      });
      setCompanies((prev) =>
        prev.map((c) =>
          c.company_id === selectedCompany.company_id ? { ...c, is_active: !c.is_active } : c
        )
      );
      setIsToggleModalOpen(false);
      setSelectedCompany(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setToggleLoading(false);
    }
  };

  const handleEdit        = useCallback((c) => { setSelectedCompany(c); setIsEditModalOpen(true);   }, []);
  const handleToggleClick = useCallback((c) => { setSelectedCompany(c); setIsToggleModalOpen(true); }, []);
  const hasFilter = searchTerm.trim() !== '' || filterStatus !== 'all';

  return (
    <>
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .leaflet-container { font-family: inherit; }
      `}</style>

      <div
        className="min-h-screen p-4 sm:p-6"
        style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-50)), white)` }}
      >
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Page header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: `rgb(var(--primary-800))` }}>
                Companies
              </h1>
              <p className="mt-1 text-sm" style={{ color: `rgb(var(--primary-500))` }}>
                Manage partner companies and OJT locations
              </p>
            </div>
            <button
              onClick={() => setIsCompanyModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm transition-all duration-150 active:scale-95"
              style={{ backgroundColor: `rgb(var(--primary-600))` }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`}
            >
              <Plus className="w-4 h-4" aria-hidden="true" /> Add Company
            </button>
          </div>

          {/* Error banner */}
          {error && (
            <div role="alert" className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" aria-hidden="true" />
              <span className="text-sm text-red-600">{error}</span>
              <button
                onClick={() => setError('')}
                aria-label="Dismiss error"
                className="ml-auto text-red-400 hover:text-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Companies', value: stats.total,    icon: Building2,   colorClass: '' },
              { label: 'Active',          value: stats.active,   icon: CheckCircle, colorClass: '' },
              { label: 'Inactive',        value: stats.inactive, icon: AlertCircle, colorClass: 'text-gray-700', iconStyle: { color: '#6b7280', backgroundColor: '#f3f4f6' } },
            ].map(({ label, value, icon: Icon, iconStyle }) => (
              <div
                key={label}
                className="bg-white rounded-xl shadow-sm px-5 py-4 flex items-center gap-4 hover:shadow-md transition-shadow duration-200"
                style={{ border: `1px solid rgb(var(--primary-50))` }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={iconStyle ?? { backgroundColor: `rgb(var(--primary-50))` }}
                  aria-hidden="true"
                >
                  <Icon
                    className="w-5 h-5"
                    style={iconStyle ? { color: iconStyle.color } : { color: `rgb(var(--primary-600))` }}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: `rgb(var(--primary-500))` }}>
                    {label}
                  </p>
                  {loading
                    ? <div className="h-7 w-10 rounded animate-pulse mt-1" style={{ backgroundColor: `rgb(var(--primary-100))` }} />
                    : <p
                        className="text-3xl font-bold"
                        style={iconStyle ? { color: iconStyle.color } : { color: `rgb(var(--primary-800))` }}
                      >
                        {value}
                      </p>
                  }
                </div>
              </div>
            ))}
          </div>

          {/* Main table card */}
          <div
            className="bg-white rounded-2xl shadow-md overflow-hidden"
            style={{ border: `1px solid rgb(var(--primary-50))` }}
          >
            {/* Table toolbar */}
            <div
              className="px-6 pt-5 pb-4"
              style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}
            >
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: `rgb(var(--primary-800))` }}>All Companies</h2>
                  {!loading && (
                    <p className="text-xs mt-0.5" style={{ color: `rgb(var(--primary-400))` }} aria-live="polite">
                      {filteredCompanies.length} of {companies.length} compan{companies.length !== 1 ? 'ies' : 'y'}
                    </p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  {/* Search */}
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                      style={{ color: `rgb(var(--primary-400))` }}
                      aria-hidden="true"
                    />
                    <label htmlFor="company-search" className="sr-only">Search companies</label>
                    <input
                      id="company-search"
                      type="text"
                      placeholder="Search company or address…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 pr-8 py-2 text-sm rounded-lg w-full sm:w-64 outline-none transition"
                      style={{
                        border: `1px solid rgb(var(--primary-200))`,
                        backgroundColor: `rgb(var(--primary-50))`,
                        color: `rgb(var(--primary-800))`,
                      }}
                      onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-300))`; e.target.style.borderColor = `rgb(var(--primary-300))`; }}
                      onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        aria-label="Clear search"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors"
                        style={{ color: `rgb(var(--primary-400))` }}
                        onMouseEnter={e => e.currentTarget.style.color = `rgb(var(--primary-600))`}
                        onMouseLeave={e => e.currentTarget.style.color = `rgb(var(--primary-400))`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {/* Filter */}
                  <div className="relative">
                    <Filter
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                      style={{ color: `rgb(var(--primary-400))` }}
                      aria-hidden="true"
                    />
                    <label htmlFor="status-filter" className="sr-only">Filter by status</label>
                    <select
                      id="status-filter"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="pl-9 pr-8 py-2 text-sm rounded-lg outline-none appearance-none cursor-pointer transition"
                      style={{
                        border: `1px solid rgb(var(--primary-200))`,
                        backgroundColor: `rgb(var(--primary-50))`,
                        color: `rgb(var(--primary-800))`,
                      }}
                      onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-300))`; e.target.style.borderColor = `rgb(var(--primary-300))`; }}
                      onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <ChevronDown
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                      style={{ color: `rgb(var(--primary-400))` }}
                      aria-hidden="true"
                    />
                  </div>
                  {hasFilter && (
                    <button
                      onClick={() => { setSearchTerm(''); setFilterStatus('all'); }}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                      style={{
                        color: `rgb(var(--primary-500))`,
                        border: `1px solid rgb(var(--primary-200))`,
                        backgroundColor: `rgb(var(--primary-50))`,
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-100))`}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`}
                    >
                      <X className="w-3 h-3" aria-hidden="true" />Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto" role="region" aria-label="Companies table">
              {loading ? (
                <div className="flex items-center justify-center py-24 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: `rgb(var(--primary-500))` }} aria-hidden="true" />
                  <p className="text-sm" style={{ color: `rgb(var(--primary-500))` }}>Loading companies…</p>
                </div>
              ) : filteredCompanies.length === 0 ? (
                <EmptyState message={hasFilter ? 'No companies match your search' : 'No companies yet'} />
              ) : (
                <table className="w-full" aria-busy={loading}>
                  <thead>
                    <tr style={{ backgroundColor: `rgb(var(--primary-50))` }}>
                      {['Company Name', 'Address', 'Students', 'Status', 'Actions'].map((col) => (
                        <th
                          key={col}
                          scope="col"
                          className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                          style={{ color: `rgb(var(--primary-600))` }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.map((company) => {
                      const hasCoords = !!(company.latitude && company.longitude);
                      return (
                        // ✅ FIX: Replaced inline onMouseEnter/onMouseLeave with Tailwind hover classes.
                        // hover:bg-gray-50 is a neutral gray that won't blend with primary-colored text.
                        <tr
                          key={company.company_id}
                          className="hover:bg-gray-50 transition-colors duration-150"
                          style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}
                        >
                          {/* Company Name + location badge */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-1 min-w-0">
                              {/* ✅ FIX: Changed from primary-900 inline style to a solid gray class for
                                  guaranteed contrast on both default and hover backgrounds. */}
                              <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                                {company.company_name}
                              </span>
                              <LocationBadge hasCoords={hasCoords} radiusMeters={company.radius_meters} />
                            </div>
                          </td>

                          {/* Address */}
                          <td className="py-3.5 px-4">
                            <Tooltip text={company.address}>
                              {/* ✅ FIX: Changed wrapper color from primary-600 inline style to text-gray-600
                                  so it stays readable on hover:bg-gray-50. Icon also uses text-gray-400. */}
                              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                                {hasCoords ? (
                                  // ✅ FIX: Link uses text-gray-600 base, darkens to text-gray-900 on hover
                                  // for a clear, accessible hover affordance without relying on primary colors.
                                  <a
                                    href={`https://www.google.com/maps?q=${company.latitude},${company.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`Open ${company.address} in Google Maps`}
                                    className="truncate max-w-xs text-gray-600 hover:text-gray-900 hover:underline transition-colors duration-150"
                                  >
                                    {company.address || '—'}
                                  </a>
                                ) : (
                                  <span className="truncate max-w-xs">{company.address || '—'}</span>
                                )}
                              </div>
                            </Tooltip>
                          </td>

                          {/* Students */}
                          <td className="py-3.5 px-4">
                            {/* ✅ FIX: Changed from primary-700 inline style to text-gray-700 for consistency. */}
                            <div className="flex items-center gap-1.5 text-sm text-gray-700">
                              <Users className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                              <span className="font-semibold">{company.total_students || 0}</span>
                            </div>
                          </td>

                          {/* Status — unchanged */}
                          <td className="py-3.5 px-4">
                            <StatusBadge isActive={company.is_active} />
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEdit(company)}
                                aria-label={`Edit ${company.company_name}`}
                                title="Edit"
                                // ✅ FIX: Replaced inline hover handlers with Tailwind classes.
                                // hover:bg-gray-100 gives a clear pressed-state without conflicting colors.
                                className="p-2 rounded-lg transition-colors duration-150 text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                              >
                                <Edit2 className="w-4 h-4" aria-hidden="true" />
                              </button>
                              <button
                                onClick={() => handleToggleClick(company)}
                                aria-label={company.is_active ? `Deactivate ${company.company_name}` : `Activate ${company.company_name}`}
                                title={company.is_active ? 'Deactivate' : 'Activate'}
                                // ✅ FIX: Unified hover behavior for both active and inactive states.
                                // Active (deactivate intent) gets a red tint; inactive gets a neutral hover.
                                className={`p-2 rounded-lg transition-colors duration-150 ${
                                  company.is_active
                                    ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                                }`}
                              >
                                <Power className="w-4 h-4" aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Table footer legend */}
            {!loading && filteredCompanies.length > 0 && (
              <div
                className="px-6 py-3 flex flex-wrap items-center justify-between gap-2"
                style={{
                  borderTop: `1px solid rgb(var(--primary-50))`,
                  backgroundColor: `rgb(var(--primary-50))`,
                }}
              >
                <p className="text-xs" style={{ color: `rgb(var(--primary-500))` }}>
                  Showing {filteredCompanies.length} of {companies.length} compan{companies.length !== 1 ? 'ies' : 'y'}
                </p>
                <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: `rgb(var(--primary-500))` }} aria-label="Legend">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: `rgb(var(--primary-500))` }} aria-hidden="true" />
                    Active
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" aria-hidden="true" />
                    Inactive
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Target className="w-3 h-3 text-blue-500" aria-hidden="true" />
                    Location + radius set
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <CompanyModal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        company={null}
        onSave={fetchCompanies}
      />
      <CompanyModal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setSelectedCompany(null); }}
        company={selectedCompany}
        onSave={fetchCompanies}
      />
      <ConfirmToggleModal
        isOpen={isToggleModalOpen}
        onClose={() => { setIsToggleModalOpen(false); setSelectedCompany(null); }}
        company={selectedCompany}
        onConfirm={handleToggleStatus}
        loading={toggleLoading}
      />
    </>
  );
};

export default CoordinatorCompanies;