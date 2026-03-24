import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Building2, Plus, Search, Edit2, Power, MapPin, Mail, Phone, Users,
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
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
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
    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
      <Building2 className="w-8 h-8 text-green-300" />
    </div>
    <p className="text-base font-semibold text-green-800">{message}</p>
  </div>
);

const Tooltip = ({ text, children }) => (
  <span className="group relative">
    {children}
    {text && (
      <span className="pointer-events-none absolute bottom-full left-0 mb-1.5 z-50 hidden group-hover:block w-max max-w-xs bg-green-900 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg leading-snug">
        {text}
        <span className="absolute top-full left-3 border-4 border-transparent border-t-green-900" />
      </span>
    )}
  </span>
);

// ── RadiusInput ───────────────────────────────────────────────────────────────
// Stores a LOCAL string draft so React never coerces the value mid-keystroke.
// PROBLEM 2 FIX: Label is now "Geofence Radius" only. The unit "m" appears
//                solely beside the number input — not duplicated in the label.

const RadiusInput = ({ value, onChange, error }) => {
  const [draft, setDraft] = useState(String(value ?? RADIUS_DEFAULT));

  useEffect(() => {
    setDraft(String(value ?? RADIUS_DEFAULT));
  }, [value]);

  const numericDraft = Number(draft);
  const clampedValue = isNaN(numericDraft)
    ? RADIUS_MIN
    : Math.min(Math.max(numericDraft, RADIUS_MIN), RADIUS_MAX);
  const pct  = ((clampedValue - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN)) * 100;
  const tier =
    clampedValue <= 50  ? 'text-blue-600'  :
    clampedValue <= 200 ? 'text-green-600' :
    clampedValue <= 500 ? 'text-amber-600' : 'text-red-500';

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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* PROBLEM 2 FIX: "Geofence Radius" only — no "(meters)" in the label */}
        <label
          htmlFor="radius-number-input"
          className="text-xs font-semibold text-green-700 uppercase tracking-wide flex items-center gap-1.5"
        >
          <Target className="w-3.5 h-3.5 text-green-500" aria-hidden="true" />
          Geofence Radius
        </label>
        {/* Unit "m" appears only here, next to the number box */}
        <div className="flex items-center gap-1.5">
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
            className={`w-20 text-center px-2 py-1 rounded-lg border text-sm font-bold transition-all outline-none focus:ring-2 focus:ring-green-100 ${
              error ? 'border-red-300 text-red-600 bg-red-50 focus:ring-red-100' : `border-green-200 bg-white ${tier}`
            }`}
          />
          <span className="text-xs text-green-500 font-medium">m</span>
        </div>
      </div>

      <div className="relative h-5 flex items-center" role="presentation">
        <div className="w-full h-2 rounded-full bg-green-100 overflow-hidden" aria-hidden="true">
          <div
            className="h-full rounded-full bg-linear-to-r from-blue-400 via-green-400 to-red-400 transition-all duration-150"
            style={{ width: `${pct}%` }}
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
          className="absolute w-4 h-4 rounded-full bg-white border-2 border-green-500 shadow-md pointer-events-none transition-all duration-150"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-green-400 font-medium" aria-hidden="true">
        <span>{RADIUS_MIN}m</span><span>250m</span><span>500m</span><span>{RADIUS_MAX}m</span>
      </div>

      {error ? (
        <p id="radius-helper-text" role="alert" className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" /> {error}
        </p>
      ) : (
        <p id="radius-helper-text" className="text-xs text-green-400 flex items-start gap-1.5 leading-relaxed">
          <Info className="w-3 h-3 shrink-0 text-green-400 mt-0.5" aria-hidden="true" />
          This radius defines the allowed GPS area around the company. Students must be inside
          this radius for their attendance location to be marked as{' '}
          <span className="font-semibold text-green-600">Verified</span>.
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" aria-hidden="true" />
          <input
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown} placeholder="Search for an address or place…"
            aria-label="Search for company address"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-green-200 text-sm text-green-900 placeholder-green-300 bg-white outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
          />
        </div>
        <button type="button" onClick={handleSearch} disabled={searching} aria-label="Search address"
          className="px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap">
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </button>
      </div>
      {searchError && (
        <p role="alert" className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" aria-hidden="true" /> {searchError}
        </p>
      )}
      <div ref={mapRef} className="w-full rounded-xl border-2 border-green-100 overflow-hidden shadow-sm"
        style={{ height: '280px', zIndex: 0 }} aria-label="Map — click to set company location" role="application" />
      {latitude && longitude ? (
        <div className="flex items-center gap-3 px-3 py-2 bg-green-50 rounded-lg border border-green-100">
          <Navigation className="w-4 h-4 text-green-500 shrink-0" aria-hidden="true" />
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-green-700 font-mono">
            <span>Lat: <strong>{parseFloat(latitude).toFixed(6)}</strong></span>
            <span>Lng: <strong>{parseFloat(longitude).toFixed(6)}</strong></span>
          </div>
          <span className="ml-auto text-[10px] text-green-400 italic">Click map to adjust</span>
        </div>
      ) : (
        <p className="text-xs text-green-400 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
          Search or click on the map to set company location
        </p>
      )}
    </div>
  );
};

// ── ModalField ────────────────────────────────────────────────────────────────
// PROBLEM 1 FIX: This component is defined at MODULE SCOPE, outside CompanyModal.
//
// Root cause of the focus-loss bug:
//   The original code defined `Field` as a `const` INSIDE CompanyModal's render
//   body. Every time CompanyModal re-rendered (i.e. on every keystroke), React
//   created a brand-new component type for `Field`. React's reconciler compares
//   component types by reference — a new function reference means a completely
//   different component, so React unmounted the old input and mounted a fresh
//   one, destroying focus in the process.
//
// Fix: Move ModalField (and its helper `inputCls`) to module scope so their
//   references are stable across renders. React then correctly reuses the
//   existing DOM nodes and focus is never lost.

const inputCls = (hasIcon, hasErr) =>
  `w-full ${hasIcon ? 'pl-9' : 'px-3.5'} pr-3.5 py-2.5 rounded-lg border text-sm text-green-900 placeholder-green-300 bg-white outline-none focus:ring-2 transition-all ${
    hasErr
      ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
      : 'border-green-200 focus:border-green-400 focus:ring-green-100'
  }`;

const ModalField = ({ label, id, icon: Icon, error: fieldErr, children }) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="text-xs font-semibold text-green-700 uppercase tracking-wide">
      {label}
    </label>
    <div className="relative">
      {Icon && (
        <Icon
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400 pointer-events-none"
          aria-hidden="true"
        />
      )}
      {children}
    </div>
    {fieldErr && (
      <p role="alert" className="text-xs text-red-500 flex items-center gap-1 animate-[fadeUp_0.15s_ease]">
        <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
        {fieldErr}
      </p>
    )}
  </div>
);

// ── CompanyModal ──────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  company_name: '', address: '', contact_person: '', contact_email: '',
  latitude: '', longitude: '', location_name: '',
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
        company_name  : company.company_name   ?? '',
        address       : company.address        ?? '',
        contact_person: company.contact_person ?? '',
        contact_email : company.contact_email  ?? '',
        latitude      : company.latitude       ?? '',
        longitude     : company.longitude      ?? '',
        location_name : company.location_name  ?? company.company_name ?? '',
        radius_meters : Number(company.radius_meters) || RADIUS_DEFAULT,
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
    setErrors((p) => ({ ...p, [field]: undefined }));
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
    if (!formData.company_name.trim())   e.company_name   = 'Company name is required';
    if (!formData.address.trim())        e.address        = 'Address is required';
    if (!formData.contact_person.trim()) e.contact_person = 'Contact person is required';
    if (!formData.contact_email.trim()) { e.contact_email = 'Email is required'; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
      e.contact_email = 'Enter a valid email address';
    }
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
        company_name  : formData.company_name,
        address       : formData.address,
        contact_person: formData.contact_person,
        contact_email : formData.contact_email,
        latitude      : formData.latitude  ? parseFloat(formData.latitude)  : null,
        longitude     : formData.longitude ? parseFloat(formData.longitude) : null,
        location_name : formData.location_name || formData.company_name,
        radius_meters : Number(formData.radius_meters) || RADIUS_DEFAULT,
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
      role="dialog" aria-modal="true"
      aria-label={isEdit ? 'Edit Company' : 'Add New Company'}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 animate-[fadeUp_0.2s_ease]">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-green-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              {isEdit ? <Edit2 className="w-5 h-5 text-green-600" /> : <Plus className="w-5 h-5 text-green-600" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-green-900">
                {isEdit ? 'Edit Company' : 'Add New Company'}
              </h2>
              <p className="text-xs text-green-500">
                {isEdit ? 'Update company information' : 'Register a new partner company'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-lg hover:bg-green-50 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-green-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-5 space-y-6">
            {submitError && (
              <div role="alert" className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg animate-[fadeUp_0.15s_ease]">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" aria-hidden="true" />
                <p className="text-sm text-red-600">{submitError}</p>
              </div>
            )}

            <section aria-label="Company information">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-green-500" aria-hidden="true" />
                <h3 className="text-sm font-bold text-green-700 uppercase tracking-wide">Company Information</h3>
              </div>
              <div className="bg-green-50/40 rounded-xl border border-green-100 p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/*
                    PROBLEM 1 FIX: Using ModalField (defined at module scope).
                    Previously `Field` was defined inside CompanyModal, making React
                    treat it as a new component type on every render and unmount/remount
                    the input — destroying focus. ModalField has a stable reference.
                  */}
                  <ModalField label="Company Name" id="company_name" error={errors.company_name}>
                    <input
                      id="company_name"
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => set('company_name', e.target.value)}
                      className={inputCls(false, !!errors.company_name)}
                      placeholder="e.g., Acme Corporation"
                      autoComplete="organization"
                    />
                  </ModalField>
                  <ModalField label="Address" id="address" error={errors.address}>
                    <input
                      id="address"
                      type="text"
                      value={formData.address}
                      onChange={(e) => set('address', e.target.value)}
                      className={inputCls(false, !!errors.address)}
                      placeholder="e.g., 123 Main St, City"
                      autoComplete="street-address"
                    />
                  </ModalField>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ModalField label="Contact Person" id="contact_person" icon={Phone} error={errors.contact_person}>
                    <input
                      id="contact_person"
                      type="text"
                      value={formData.contact_person}
                      onChange={(e) => set('contact_person', e.target.value)}
                      className={inputCls(true, !!errors.contact_person)}
                      placeholder="e.g., John Doe"
                    />
                  </ModalField>
                  <ModalField label="Contact Email" id="contact_email" icon={Mail} error={errors.contact_email}>
                    <input
                      id="contact_email"
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => set('contact_email', e.target.value)}
                      className={inputCls(true, !!errors.contact_email)}
                      placeholder="contact@company.com"
                      autoComplete="email"
                    />
                  </ModalField>
                </div>
              </div>
            </section>

            <section aria-label="Location and geofence settings">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-green-500" aria-hidden="true" />
                <h3 className="text-sm font-bold text-green-700 uppercase tracking-wide">Location & Geofence</h3>
              </div>
              <div className="bg-green-50/40 rounded-xl border border-green-100 p-4 space-y-5">
                <LeafletLocationPicker
                  latitude={formData.latitude}
                  longitude={formData.longitude}
                  radius={formData.radius_meters}
                  onLocationChange={handleLocationChange}
                />
                <div className="border-t border-green-100" />
                <RadiusInput
                  value={formData.radius_meters}
                  onChange={handleRadiusChange}
                  error={errors.radius_meters}
                />
              </div>
            </section>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 px-6 py-4 border-t border-green-50 bg-green-50/30 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-green-200 text-green-700 text-sm font-semibold hover:bg-green-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-sm"
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
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog" aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-[fadeUp_0.2s_ease]">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${isDeactivating ? 'bg-red-50' : 'bg-green-50'}`}>
          <Power className={`w-7 h-7 ${isDeactivating ? 'text-red-500' : 'text-green-500'}`} aria-hidden="true" />
        </div>
        <h3 className="text-lg font-bold text-green-900 text-center mb-1">
          {isDeactivating ? 'Deactivate Company' : 'Activate Company'}
        </h3>
        <p className="text-sm text-green-600 text-center mb-6">
          Are you sure you want to {isDeactivating ? 'deactivate' : 'activate'}{' '}
          <span className="font-semibold text-green-800">{company.company_name}</span>?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg border border-green-200 text-green-700 text-sm font-semibold hover:bg-green-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              isDeactivating ? 'bg-red-500 hover:bg-red-600 disabled:bg-red-300' : 'bg-green-600 hover:bg-green-700 disabled:bg-green-300'
            }`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {isDeactivating ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── AdminCompanies (main) ─────────────────────────────────────────────────────

const AdminCompanies = () => {
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
        c.company_name?.toLowerCase().includes(s)   ||
        c.address?.toLowerCase().includes(s)        ||
        c.contact_person?.toLowerCase().includes(s) ||
        c.contact_email?.toLowerCase().includes(s)
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
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .leaflet-container { font-family: inherit; }
      `}</style>

      <div className="min-h-screen bg-linear-to-br from-green-50 to-white p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-6">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center shadow-md">
                <Building2 className="w-6 h-6 text-white" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-green-900">Companies Management</h1>
                <p className="text-sm text-green-500 mt-0.5">Manage partner companies and OJT locations</p>
              </div>
            </div>
            <button
              onClick={() => setIsCompanyModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 active:scale-95 text-white font-semibold text-sm rounded-xl shadow-md transition-all duration-150 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" aria-hidden="true" /> Add Company
            </button>
          </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Companies', value: stats.total,    icon: Building2,   iconClass: 'text-green-600 bg-green-100',    valueClass: 'text-green-800'   },
              { label: 'Active',          value: stats.active,   icon: CheckCircle, iconClass: 'text-emerald-600 bg-emerald-100', valueClass: 'text-emerald-700' },
              { label: 'Inactive',        value: stats.inactive, icon: AlertCircle, iconClass: 'text-gray-500 bg-gray-100',       valueClass: 'text-gray-700'    },
            ].map(({ label, value, icon: Icon, iconClass, valueClass }) => (
              <div key={label} className="bg-white rounded-xl shadow-sm border border-green-50 px-5 py-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconClass}`} aria-hidden="true">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-green-500 font-medium">{label}</p>
                  {loading
                    ? <div className="h-7 w-10 bg-green-100 rounded animate-pulse mt-1" />
                    : <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
                  }
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-md border border-green-50 overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-green-50">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-green-800">All Companies</h2>
                  {!loading && (
                    <p className="text-xs text-green-400 mt-0.5" aria-live="polite">
                      {filteredCompanies.length} of {companies.length} compan{companies.length !== 1 ? 'ies' : 'y'}
                    </p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400 pointer-events-none" aria-hidden="true" />
                    <label htmlFor="company-search" className="sr-only">Search companies</label>
                    <input
                      id="company-search"
                      type="text"
                      placeholder="Search company, address, contact…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 pr-8 py-2 rounded-lg border border-green-200 text-sm text-green-800 placeholder-green-300 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 w-full sm:w-64 transition-all"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        aria-label="Clear search"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-400 hover:text-green-600 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400 pointer-events-none" aria-hidden="true" />
                    <label htmlFor="status-filter" className="sr-only">Filter by status</label>
                    <select
                      id="status-filter"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="pl-9 pr-8 py-2 rounded-lg border border-green-200 text-sm text-green-800 bg-white focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 appearance-none transition-all"
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-green-400 pointer-events-none" aria-hidden="true" />
                  </div>
                  {hasFilter && (
                    <button
                      onClick={() => { setSearchTerm(''); setFilterStatus('all'); }}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-green-500 border border-green-200 bg-green-50 hover:bg-green-100 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <X className="w-3 h-3" aria-hidden="true" />Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto" role="region" aria-label="Companies table">
              {loading ? (
                <div className="flex items-center justify-center py-24 gap-3">
                  <Loader2 className="w-8 h-8 text-green-500 animate-spin" aria-hidden="true" />
                  <p className="text-sm text-green-500">Loading companies…</p>
                </div>
              ) : filteredCompanies.length === 0 ? (
                <EmptyState message={hasFilter ? 'No companies match your search' : 'No companies yet'} />
              ) : (
                <table className="w-full" aria-busy={loading}>
                  <thead>
                    <tr className="bg-green-50/60">
                      {['Company Name','Address','Contact Person','Contact Email','Students','Status','Actions'].map((col) => (
                        <th key={col} scope="col" className="text-left py-3 px-4 text-xs font-semibold text-green-600 uppercase tracking-wider whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.map((company) => {
                      const hasCoords = !!(company.latitude && company.longitude);
                      return (
                        <tr key={company.company_id} className="border-b border-green-50 hover:bg-green-50/40 transition-colors duration-150 group">
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-1 min-w-0">
                              <span className="text-sm font-semibold text-green-900 whitespace-nowrap">{company.company_name}</span>
                              <LocationBadge hasCoords={hasCoords} radiusMeters={company.radius_meters} />
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <Tooltip text={company.address}>
                              <div className="flex items-center gap-1.5 text-sm text-green-600">
                                <MapPin className="w-3.5 h-3.5 text-green-400 shrink-0" aria-hidden="true" />
                                {hasCoords ? (
                                  <a
                                    href={`https://www.google.com/maps?q=${company.latitude},${company.longitude}`}
                                    target="_blank" rel="noopener noreferrer"
                                    aria-label={`Open ${company.address} in Google Maps`}
                                    className="truncate max-w-45 hover:underline hover:text-green-700"
                                  >
                                    {company.address || '—'}
                                  </a>
                                ) : (
                                  <span className="truncate max-w-45">{company.address || '—'}</span>
                                )}
                              </div>
                            </Tooltip>
                          </td>
                          <td className="py-3.5 px-4">
                            <Tooltip text={company.contact_person}>
                              <div className="flex items-center gap-1.5 text-sm text-green-700">
                                <Phone className="w-3.5 h-3.5 text-green-400 shrink-0" aria-hidden="true" />
                                <span className="truncate max-w-30">{company.contact_person || '—'}</span>
                              </div>
                            </Tooltip>
                          </td>
                          <td className="py-3.5 px-4">
                            <Tooltip text={company.contact_email}>
                              <div className="flex items-center gap-1.5 text-sm text-green-600">
                                <Mail className="w-3.5 h-3.5 text-green-400 shrink-0" aria-hidden="true" />
                                <span className="truncate max-w-37.5">{company.contact_email || '—'}</span>
                              </div>
                            </Tooltip>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 text-sm text-green-700">
                              <Users className="w-3.5 h-3.5 text-green-400" aria-hidden="true" />
                              <span className="font-semibold">{company.total_students || 0}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <StatusBadge isActive={company.is_active} />
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEdit(company)}
                                aria-label={`Edit ${company.company_name}`}
                                title="Edit"
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              >
                                <Edit2 className="w-4 h-4" aria-hidden="true" />
                              </button>
                              <button
                                onClick={() => handleToggleClick(company)}
                                aria-label={company.is_active ? `Deactivate ${company.company_name}` : `Activate ${company.company_name}`}
                                title={company.is_active ? 'Deactivate' : 'Activate'}
                                className={`p-2 rounded-lg transition-colors ${company.is_active ? 'text-gray-500 hover:bg-gray-100' : 'text-green-600 hover:bg-green-50'}`}
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

            {!loading && filteredCompanies.length > 0 && (
              <div className="px-6 py-3 border-t border-green-50 bg-green-50/30 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-green-500">
                  Showing {filteredCompanies.length} of {companies.length} compan{companies.length !== 1 ? 'ies' : 'y'}
                </p>
                <div className="flex items-center gap-4 text-xs text-green-500 flex-wrap" aria-label="Legend">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" aria-hidden="true" /> Active</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" aria-hidden="true" /> Inactive</span>
                  <span className="flex items-center gap-1.5"><Target className="w-3 h-3 text-blue-500" aria-hidden="true" /> Location + radius set</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

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

export default AdminCompanies;