import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PickerSelect } from "@/components/ui/PickerSelect";
import { lookupPincode } from "@/lib/pincode";

export const INDIA_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
].map((s) => ({ value: s, label: s }));

export interface AddressValue {
  address: string;
  pincode: string;
  city: string;
  state: string;
}

const input = "border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30";
const label = "block text-xs font-bold text-black mb-1";

/** Address textarea + pincode (auto-fills city & state via India Post API) + city + state picker. */
export function AddressFields({
  value,
  onChange,
  addressLabel,
}: {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  addressLabel: string;
}) {
  const [looking, setLooking] = useState(false);
  const [note, setNote] = useState("");

  const setPin = async (pin: string) => {
    const next = { ...value, pincode: pin };
    onChange(next);
    setNote("");
    if (pin.length !== 6) return;
    setLooking(true);
    const hit = await lookupPincode(pin);
    setLooking(false);
    if (hit) onChange({ ...next, city: hit.city, state: hit.state });
    else setNote("Pincode not found - pick state and enter city manually");
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <label className={label}>{addressLabel}</label>
        <textarea
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          className={`${input} resize-none`}
          rows={2}
          placeholder="House no., street, area"
        />
      </div>
      <div>
        <label className={label}>Pincode</label>
        <div className="relative">
          <input
            inputMode="numeric"
            maxLength={6}
            value={value.pincode}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className={input}
            placeholder="6-digit pincode"
          />
          {looking && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3 text-[#024BAB]" />}
        </div>
        {note && <p className="text-[10px] text-amber-700 mt-1">{note}</p>}
      </div>
      <div>
        <label className={label}>City</label>
        <input
          value={value.city}
          onChange={(e) => onChange({ ...value, city: e.target.value })}
          className={input}
          placeholder="City / District"
        />
      </div>
      <div className="col-span-2">
        <label className={label}>State</label>
        <PickerSelect
          value={value.state}
          onChange={(state) => onChange({ ...value, state })}
          options={INDIA_STATES}
          placeholder="Select state"
        />
      </div>
    </div>
  );
}
