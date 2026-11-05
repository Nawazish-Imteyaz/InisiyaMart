"use client";

export const STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

export interface Addr { name: string; phone: string; address: string; city: string; state: string; pincode: string }
export const emptyAddr: Addr = { name: "", phone: "", address: "", city: "", state: "", pincode: "" };

export interface SavedAddress extends Addr { id: number; label: string; is_default: number }

/** Name, mobile, address, city, PIN, state: the same fields at checkout and in My account. */
export function AddressFields({ v, onChange }: { v: Addr; onChange: (k: keyof Addr, value: string) => void }) {
  return (
    <div className="form-grid">
      <label className="form-field">Full name *<input required autoComplete="name" maxLength={100} value={v.name} onChange={(e) => onChange("name", e.target.value)} /></label>
      <label className="form-field">Mobile number *<input required type="tel" inputMode="tel" autoComplete="tel-national" maxLength={14} placeholder="10-digit number" value={v.phone} onChange={(e) => onChange("phone", e.target.value)} /><small>We send order updates on WhatsApp.</small></label>
      <label className="form-field wide">Address *<textarea required rows={2} autoComplete="street-address" maxLength={400} placeholder="House no., street, area, landmark" value={v.address} onChange={(e) => onChange("address", e.target.value)} /></label>
      <label className="form-field">City / town *<input required autoComplete="address-level2" maxLength={60} value={v.city} onChange={(e) => onChange("city", e.target.value)} /></label>
      <label className="form-field">PIN code *<input required inputMode="numeric" autoComplete="postal-code" maxLength={6} value={v.pincode} onChange={(e) => onChange("pincode", e.target.value.replace(/\D/g, ""))} /></label>
      <label className="form-field">State *
        <select required autoComplete="address-level1" value={v.state} onChange={(e) => onChange("state", e.target.value)}>
          <option value="">Choose…</option>
          {STATES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
    </div>
  );
}

export function addrProblem(v: Addr): string {
  if (!v.name.trim()) return "Please enter the full name.";
  if (!/^[6-9][0-9]{9}$/.test(v.phone.replace(/\D/g, "").slice(-10))) return "Please enter a valid 10-digit mobile number.";
  if (!v.address.trim()) return "Please enter the address.";
  if (!v.city.trim()) return "Please enter the city or town.";
  if (!/^[1-9][0-9]{5}$/.test(v.pincode)) return "Please enter a valid 6-digit PIN code.";
  if (!v.state) return "Please choose the state.";
  return "";
}
