import { useEffect, useRef, useState } from "react";

// Google Maps picker: search a place by name, click the map or drag the pin; shows the radius as a circle.
// Needs VITE_GOOGLE_MAPS_KEY (Maps JavaScript API + Places API enabled, key restricted to our domains).
export const GMAPS_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_KEY as string | undefined;

let loader: Promise<any> | null = null;
function loadGoogle(): Promise<any> {
  const w = window as any;
  if (w.google?.maps?.places) return Promise.resolve(w.google);
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places`;
      s.async = true;
      s.onload = () => resolve(w.google);
      s.onerror = () => { loader = null; reject(new Error("Google Maps failed to load")); };
      document.head.appendChild(s);
    });
  }
  return loader;
}

type Props = { lat: string; lng: string; radius: string; onChange: (lat: string, lng: string) => void };

export default function GeofencePicker({ lat, lng, radius, onChange }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const inputEl = useRef<HTMLInputElement>(null);
  const g = useRef<{ map?: any; marker?: any; circle?: any }>({});
  const cb = useRef(onChange);
  cb.current = onChange;
  const [err, setErr] = useState("");

  useEffect(() => {
    let dead = false;
    loadGoogle().then((google) => {
      if (dead || !mapEl.current || !inputEl.current) return;
      const la = parseFloat(lat), ln = parseFloat(lng);
      const has = !isNaN(la) && !isNaN(ln);
      const center = has ? { lat: la, lng: ln } : { lat: 28.6139, lng: 77.209 };
      const map = new google.maps.Map(mapEl.current, { center, zoom: has ? 17 : 5, streetViewControl: false, mapTypeControl: false });
      const marker = new google.maps.Marker({ map, position: center, draggable: true, visible: has });
      const circle = new google.maps.Circle({ map, center, radius: Number(radius) || 200, visible: has, strokeColor: "#024BAB", fillColor: "#024BAB", fillOpacity: 0.15 });
      g.current = { map, marker, circle };
      const set = (p: { lat: number; lng: number }) => {
        marker.setPosition(p); marker.setVisible(true);
        circle.setCenter(p); circle.setVisible(true);
        cb.current(p.lat.toFixed(6), p.lng.toFixed(6));
      };
      map.addListener("click", (e: any) => set({ lat: e.latLng.lat(), lng: e.latLng.lng() }));
      marker.addListener("dragend", (e: any) => set({ lat: e.latLng.lat(), lng: e.latLng.lng() }));
      const ac = new google.maps.places.Autocomplete(inputEl.current, { fields: ["geometry", "name"] });
      ac.addListener("place_changed", () => {
        const loc = ac.getPlace()?.geometry?.location;
        if (!loc) return;
        const p = { lat: loc.lat(), lng: loc.lng() };
        map.setCenter(p); map.setZoom(17); set(p);
      });
    }).catch((e) => setErr(e.message));
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the circle in step with the radius box and with typed coordinates
  useEffect(() => {
    const { circle, marker, map } = g.current;
    if (!circle) return;
    circle.setRadius(Number(radius) || 200);
    const la = parseFloat(lat), ln = parseFloat(lng);
    if (!isNaN(la) && !isNaN(ln)) {
      const p = { lat: la, lng: ln };
      marker.setPosition(p); marker.setVisible(true); circle.setCenter(p); circle.setVisible(true); map.panTo(p);
    }
  }, [lat, lng, radius]);

  if (err) return <p className="text-xs text-red-600 mb-3">{err}</p>;
  return (
    <div className="mb-3">
      <label className="text-xs font-bold uppercase tracking-wider block mb-1">Find office on Google Maps</label>
      <input ref={inputEl} placeholder="Search office name or address" onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
        className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 mb-2" />
      <div ref={mapEl} className="border-2 border-black w-full h-64" />
      <p className="text-[11px] text-muted-foreground mt-1">Search, or click the map / drag the pin to the exact spot. The blue circle is the allowed radius.</p>
    </div>
  );
}
