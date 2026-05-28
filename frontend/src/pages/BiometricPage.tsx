import { useState, useEffect, useCallback, useRef } from "react";
import { biometricAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  MapPin,
  Cpu,
  Activity,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  RefreshCw,
  CreditCard,
  Users,
  Clock,
  Loader2,
  Eye,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "locations" | "devices" | "logs";

interface Location {
  _id: string;
  name: string;
  address?: string;
  description?: string;
  isActive: boolean;
}

interface NfcCard {
  uid: string;
  label?: string;
  employee: {
    _id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  };
  assignedAt: string;
}

interface Device {
  _id: string;
  name: string;
  location: { _id: string; name: string; address?: string };
  deviceToken: string;
  nfcCards: NfcCard[];
  isActive: boolean;
  lastSeenAt?: string;
}

interface BiometricLog {
  _id: string;
  employee: {
    _id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  };
  device: { _id: string; name: string };
  location: { _id: string; name: string };
  method: "nfc" | "face" | "pin";
  type: "check_in" | "check_out";
  nfcUid?: string;
  timestamp: string;
}

export default function BiometricPage() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [tab, setTab] = useState<Tab>("locations");

  // Locations state
  const [locations, setLocations] = useState<Location[]>([]);
  const [locLoading, setLocLoading] = useState(false);
  const [locForm, setLocForm] = useState({
    name: "",
    address: "",
    description: "",
  });
  const [editingLoc, setEditingLoc] = useState<string | null>(null);
  const [showLocForm, setShowLocForm] = useState(false);
  const [locSaving, setLocSaving] = useState(false);

  // Devices state
  const [devices, setDevices] = useState<Device[]>([]);
  const [devLoading, setDevLoading] = useState(false);
  const [showDevForm, setShowDevForm] = useState(false);
  const [devSaving, setDevSaving] = useState(false);
  const [devForm, setDevForm] = useState({ name: "", location: "" });
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [nfcForm, setNfcForm] = useState({
    uid: "",
    employeeId: "",
    label: "",
  });
  const [employees, setEmployees] = useState<any[]>([]);
  const [showTokenFor, setShowTokenFor] = useState<string | null>(null);

  // Logs state
  const [logs, setLogs] = useState<BiometricLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState({ locationId: "", date: "" });

  const fetchLocations = useCallback(async () => {
    setLocLoading(true);
    try {
      const res = await biometricAPI.getLocations();
      setLocations(res.data);
    } catch (e: any) {
      toastRef.current({
        title: "Error",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLocLoading(false);
    }
  }, []);

  const fetchDevices = useCallback(async () => {
    setDevLoading(true);
    try {
      const res = await biometricAPI.getDevices();
      setDevices(res.data);
    } catch (e: any) {
      toastRef.current({
        title: "Error",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setDevLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (logFilter.locationId) params.locationId = logFilter.locationId;
      if (logFilter.date) params.date = logFilter.date;
      const res = await biometricAPI.getLogs(params);
      setLogs(res.data);
    } catch (e: any) {
      toastRef.current({
        title: "Error",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLogsLoading(false);
    }
  }, [logFilter]);

  const fetchEmployees = useCallback(async () => {
    try {
      const { employeeAPI } = await import("@/services/api");
      const res = await employeeAPI.getAll();
      setEmployees(res.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);
  useEffect(() => {
    if (tab === "devices") {
      fetchDevices();
      fetchEmployees();
    }
  }, [tab, fetchDevices, fetchEmployees]);
  useEffect(() => {
    if (tab === "logs") fetchLogs();
  }, [tab, fetchLogs]);

  // ── Location actions ──────────────────────────────────────────────────────

  const handleSaveLocation = async () => {
    if (!locForm.name.trim() || locSaving) return;
    setLocSaving(true);
    try {
      if (editingLoc) {
        const res = await biometricAPI.updateLocation(editingLoc, locForm);
        setLocations((prev) =>
          prev.map((l) => (l._id === editingLoc ? res.data : l)),
        );
        toast({ title: "Location updated" });
      } else {
        const res = await biometricAPI.createLocation(locForm);
        setLocations((prev) => [res.data, ...prev]);
        toast({ title: "Location created" });
      }
      setLocForm({ name: "", address: "", description: "" });
      setEditingLoc(null);
      setShowLocForm(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLocSaving(false);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (
      !confirm("Delete this location? Associated devices will be deactivated.")
    )
      return;
    try {
      await biometricAPI.deleteLocation(id);
      setLocations((prev) => prev.filter((l) => l._id !== id));
      toast({ title: "Location deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const startEditLoc = (loc: Location) => {
    setEditingLoc(loc._id);
    setLocForm({
      name: loc.name,
      address: loc.address || "",
      description: loc.description || "",
    });
    setShowLocForm(true);
  };

  // ── Device actions ────────────────────────────────────────────────────────

  const handleCreateDevice = async () => {
    if (!devForm.name.trim() || !devForm.location || devSaving) return;
    setDevSaving(true);
    try {
      const res = await biometricAPI.createDevice(devForm);
      setDevices((prev) => [res.data, ...prev]);
      setDevForm({ name: "", location: "" });
      setShowDevForm(false);
      toast({
        title: "Device created",
        description: "Save the device token to open the device page.",
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDevSaving(false);
    }
  };

  const handleRegenerateToken = async (deviceId: string) => {
    if (!confirm("Regenerate device token? The device page URL will change."))
      return;
    try {
      const res = await biometricAPI.regenerateDeviceToken(deviceId);
      setDevices((prev) =>
        prev.map((d) =>
          d._id === deviceId ? { ...d, deviceToken: res.data.deviceToken } : d,
        ),
      );
      toast({ title: "Token regenerated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleToggleDevice = async (device: Device) => {
    try {
      const res = await biometricAPI.updateDevice(device._id, {
        isActive: !device.isActive,
      });
      setDevices((prev) =>
        prev.map((d) =>
          d._id === device._id ? { ...d, isActive: res.data.isActive } : d,
        ),
      );
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDeleteDevice = async (id: string) => {
    if (!confirm("Delete this device?")) return;
    try {
      await biometricAPI.deleteDevice(id);
      setDevices((prev) => prev.filter((d) => d._id !== id));
      if (selectedDevice?._id === id) setSelectedDevice(null);
      toast({ title: "Device deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleAssignNfc = async () => {
    if (!selectedDevice || !nfcForm.uid.trim() || !nfcForm.employeeId) return;
    try {
      const res = await biometricAPI.assignNfcCard(selectedDevice._id, nfcForm);
      setDevices((prev) =>
        prev.map((d) => (d._id === selectedDevice._id ? res.data : d)),
      );
      setSelectedDevice(res.data);
      setNfcForm({ uid: "", employeeId: "", label: "" });
      toast({ title: "NFC card assigned" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleRemoveNfc = async (uid: string) => {
    if (!selectedDevice) return;
    try {
      const res = await biometricAPI.removeNfcCard(selectedDevice._id, uid);
      setDevices((prev) =>
        prev.map((d) => (d._id === selectedDevice._id ? res.data : d)),
      );
      setSelectedDevice(res.data);
      toast({ title: "NFC card removed" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const devicePageUrl = (token: string) =>
    `${window.location.origin}/device/${token}`;

  // ── Render ────────────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "locations", label: "Locations", icon: MapPin },
    { id: "devices", label: "Devices", icon: Cpu },
    { id: "logs", label: "Activity Logs", icon: Activity },
  ];

  return (
    <AppLayout title="Biometric System">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display font-black text-3xl text-black">
            Biometric System
          </h1>
          <p className="text-gray-600 font-medium mt-1">
            Manage locations, devices, NFC cards and attendance logs
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-8 border-2 border-black w-fit overflow-hidden nb-shadow-sm">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm font-black uppercase transition-all",
                tab === t.id
                  ? "bg-[#024BAB] text-white"
                  : "bg-white text-black hover:bg-gray-50",
                t.id !== "logs" && "border-r-2 border-black",
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── LOCATIONS TAB ─────────────────────────────────────────────────── */}
        {tab === "locations" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-black text-lg">Biometric Locations</h2>
              <button
                onClick={() => {
                  setShowLocForm(true);
                  setEditingLoc(null);
                  setLocForm({ name: "", address: "", description: "" });
                }}
                className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-black text-sm uppercase nb-shadow-sm hover:nb-shadow transition-all"
              >
                <Plus className="w-4 h-4" /> Add Location
              </button>
            </div>

            {showLocForm && (
              <div className="bg-white border-2 border-black p-6 mb-6 nb-shadow">
                <h3 className="font-black mb-4">
                  {editingLoc ? "Edit Location" : "New Location"}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase mb-1">
                      Location Name *
                    </label>
                    <input
                      value={locForm.name}
                      onChange={(e) =>
                        setLocForm((p) => ({ ...p, name: e.target.value }))
                      }
                      placeholder="e.g. Main Office Gate"
                      className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase mb-1">
                      Address
                    </label>
                    <input
                      value={locForm.address}
                      onChange={(e) =>
                        setLocForm((p) => ({ ...p, address: e.target.value }))
                      }
                      placeholder="e.g. Floor 1, Building A"
                      className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black uppercase mb-1">
                      Description
                    </label>
                    <input
                      value={locForm.description}
                      onChange={(e) =>
                        setLocForm((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Optional description"
                      className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleSaveLocation}
                    disabled={locSaving}
                    className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-black text-sm uppercase nb-shadow-sm disabled:opacity-60"
                  >
                    {locSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}{" "}
                    {locSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setShowLocForm(false);
                      setEditingLoc(null);
                    }}
                    className="flex items-center gap-2 bg-white border-2 border-black px-4 py-2 font-black text-sm uppercase"
                  >
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </div>
              </div>
            )}

            {locLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#024BAB]" />
              </div>
            ) : locations.length === 0 ? (
              <div className="text-center py-12 bg-white border-2 border-black">
                <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="font-black text-gray-500">
                  No locations yet. Add one to get started.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {locations.map((loc) => (
                  <div
                    key={loc._id}
                    className="bg-white border-2 border-black p-5 nb-shadow-sm"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-2.5 h-2.5 rounded-full border border-black",
                            loc.isActive ? "bg-green-500" : "bg-gray-300",
                          )}
                        />
                        <h3 className="font-black text-base">{loc.name}</h3>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEditLoc(loc)}
                          className="p-1.5 border border-gray-200 hover:border-black hover:bg-gray-50 transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteLocation(loc._id)}
                          className="p-1.5 border border-gray-200 hover:border-red-500 hover:text-red-500 hover:bg-red-50 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {loc.address && (
                      <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {loc.address}
                      </p>
                    )}
                    {loc.description && (
                      <p className="text-xs text-gray-400 mt-1">
                        {loc.description}
                      </p>
                    )}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span
                        className={cn(
                          "text-xs font-black uppercase px-2 py-0.5 border",
                          loc.isActive
                            ? "bg-green-50 text-green-700 border-green-300"
                            : "bg-gray-50 text-gray-500 border-gray-200",
                        )}
                      >
                        {loc.isActive ? "Active" : "Inactive"}
                      </span>
                      <span className="text-xs text-gray-400">
                        {
                          devices.filter((d) => d.location?._id === loc._id)
                            .length
                        }{" "}
                        devices
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── DEVICES TAB ───────────────────────────────────────────────────── */}
        {tab === "devices" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Device list */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-black text-lg">Devices</h2>
                <button
                  onClick={() => setShowDevForm((p) => !p)}
                  className="flex items-center gap-1.5 bg-[#024BAB] text-white border-2 border-black px-3 py-1.5 font-black text-xs uppercase nb-shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>

              {showDevForm && (
                <div className="bg-white border-2 border-black p-4 mb-4 nb-shadow-sm">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-black uppercase mb-1">
                        Device Name *
                      </label>
                      <input
                        value={devForm.name}
                        onChange={(e) =>
                          setDevForm((p) => ({ ...p, name: e.target.value }))
                        }
                        placeholder="e.g. Entry Terminal 1"
                        className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase mb-1">
                        Location *
                      </label>
                      <select
                        value={devForm.location}
                        onChange={(e) =>
                          setDevForm((p) => ({
                            ...p,
                            location: e.target.value,
                          }))
                        }
                        className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none bg-white"
                      >
                        <option value="">Select location</option>
                        {locations
                          .filter((l) => l.isActive)
                          .map((l) => (
                            <option key={l._id} value={l._id}>
                              {l.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateDevice}
                        disabled={devSaving}
                        className="flex-1 bg-[#024BAB] text-white border-2 border-black py-2 font-black text-xs uppercase disabled:opacity-60 flex items-center justify-center gap-1"
                      >
                        {devSaving && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        )}
                        {devSaving ? "Creating..." : "Create"}
                      </button>
                      <button
                        onClick={() => setShowDevForm(false)}
                        className="flex-1 bg-white border-2 border-black py-2 font-black text-xs uppercase"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {devLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#024BAB]" />
                </div>
              ) : (
                <div className="space-y-3">
                  {devices.map((dev) => (
                    <button
                      key={dev._id}
                      onClick={() => setSelectedDevice(dev)}
                      className={cn(
                        "w-full text-left p-4 border-2 transition-all",
                        selectedDevice?._id === dev._id
                          ? "border-[#024BAB] bg-blue-50 nb-shadow"
                          : "border-black bg-white hover:nb-shadow-sm",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "w-2 h-2 rounded-full",
                              dev.isActive ? "bg-green-500" : "bg-gray-300",
                            )}
                          />
                          <span className="font-black text-sm">{dev.name}</span>
                        </div>
                        <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          {dev.nfcCards.length}/10
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {dev.location?.name}
                      </p>
                      {dev.lastSeenAt && (
                        <p className="text-xs text-gray-400 mt-1">
                          Last seen: {new Date(dev.lastSeenAt).toLocaleString()}
                        </p>
                      )}
                    </button>
                  ))}
                  {devices.length === 0 && !devLoading && (
                    <div className="text-center py-8 text-gray-400 font-medium text-sm">
                      No devices yet
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Device detail */}
            <div className="lg:col-span-3">
              {!selectedDevice ? (
                <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-300 bg-white py-20">
                  <div className="text-center">
                    <Cpu className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">
                      Select a device to manage
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-white border-2 border-black nb-shadow">
                  {/* Device header */}
                  <div className="p-5 border-b-2 border-black">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-black text-xl">
                          {selectedDevice.name}
                        </h3>
                        <p className="text-sm text-gray-500 font-medium flex items-center gap-1 mt-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {selectedDevice.location?.name}
                          {selectedDevice.location?.address &&
                            ` · ${selectedDevice.location.address}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleDevice(selectedDevice)}
                          className="p-2 border-2 border-black hover:bg-gray-50 transition-all"
                          title={
                            selectedDevice.isActive ? "Deactivate" : "Activate"
                          }
                        >
                          {selectedDevice.isActive ? (
                            <ToggleRight className="w-4 h-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteDevice(selectedDevice._id)}
                          className="p-2 border-2 border-black hover:bg-red-50 hover:border-red-500 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Device token */}
                    <div className="mt-4 p-3 bg-gray-50 border-2 border-dashed border-gray-300">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black uppercase text-gray-500">
                          Device Page URL
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() =>
                              setShowTokenFor(
                                showTokenFor === selectedDevice._id
                                  ? null
                                  : selectedDevice._id,
                              )
                            }
                            className="text-xs font-black text-[#024BAB] flex items-center gap-1 hover:underline"
                          >
                            <Eye className="w-3 h-3" />
                            {showTokenFor === selectedDevice._id
                              ? "Hide"
                              : "Show"}
                          </button>
                          <button
                            onClick={() =>
                              copyToClipboard(
                                devicePageUrl(selectedDevice.deviceToken),
                              )
                            }
                            className="text-xs font-black text-gray-500 flex items-center gap-1 hover:text-black"
                          >
                            <Copy className="w-3 h-3" /> Copy URL
                          </button>
                          <a
                            href={devicePageUrl(selectedDevice.deviceToken)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-black text-gray-500 flex items-center gap-1 hover:text-black"
                          >
                            <ExternalLink className="w-3 h-3" /> Open
                          </a>
                        </div>
                      </div>
                      {showTokenFor === selectedDevice._id && (
                        <p className="text-xs font-mono text-gray-600 break-all mt-1">
                          {devicePageUrl(selectedDevice.deviceToken)}
                        </p>
                      )}
                      <button
                        onClick={() =>
                          handleRegenerateToken(selectedDevice._id)
                        }
                        className="mt-2 flex items-center gap-1 text-xs font-black text-red-500 hover:underline"
                      >
                        <RefreshCw className="w-3 h-3" /> Regenerate Token
                        (invalidates current URL)
                      </button>
                    </div>
                  </div>

                  {/* NFC Cards */}
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-black flex items-center gap-2">
                        <CreditCard className="w-4 h-4" /> NFC Cards
                        <span className="text-xs font-medium text-gray-500">
                          ({selectedDevice.nfcCards.length}/10)
                        </span>
                      </h4>
                    </div>

                    {selectedDevice.nfcCards.length < 10 && (
                      <div className="border-2 border-dashed border-gray-300 p-4 mb-4">
                        <p className="text-xs font-black uppercase mb-3 text-gray-500">
                          Assign New Card
                        </p>
                        <div className="grid grid-cols-1 gap-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-black uppercase mb-1">
                                NFC Card UID *
                              </label>
                              <input
                                value={nfcForm.uid}
                                onChange={(e) =>
                                  setNfcForm((p) => ({
                                    ...p,
                                    uid: e.target.value,
                                  }))
                                }
                                placeholder="e.g. A3F2B1C0"
                                className="w-full border-2 border-black px-3 py-2 text-sm font-medium font-mono focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-black uppercase mb-1">
                                Label (optional)
                              </label>
                              <input
                                value={nfcForm.label}
                                onChange={(e) =>
                                  setNfcForm((p) => ({
                                    ...p,
                                    label: e.target.value,
                                  }))
                                }
                                placeholder="e.g. Card #1"
                                className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-black uppercase mb-1">
                              Employee *
                            </label>
                            <select
                              value={nfcForm.employeeId}
                              onChange={(e) =>
                                setNfcForm((p) => ({
                                  ...p,
                                  employeeId: e.target.value,
                                }))
                              }
                              className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white focus:outline-none"
                            >
                              <option value="">Select employee</option>
                              {employees.map((emp) => (
                                <option key={emp._id} value={emp._id}>
                                  {emp.firstName} {emp.lastName} (
                                  {emp.employeeId})
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            onClick={handleAssignNfc}
                            disabled={!nfcForm.uid || !nfcForm.employeeId}
                            className="bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-black text-xs uppercase disabled:opacity-50"
                          >
                            Assign Card
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedDevice.nfcCards.length === 0 ? (
                      <p className="text-sm text-gray-400 font-medium text-center py-4">
                        No NFC cards assigned
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedDevice.nfcCards.map((card) => (
                          <div
                            key={card.uid}
                            className="flex items-center justify-between p-3 border-2 border-black bg-gray-50"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-[#024BAB] border-2 border-black flex items-center justify-center">
                                <CreditCard className="w-4 h-4 text-white" />
                              </div>
                              <div>
                                <p className="font-black text-sm font-mono">
                                  {card.uid}
                                </p>
                                <p className="text-xs text-gray-500 font-medium">
                                  {card.employee.firstName}{" "}
                                  {card.employee.lastName} ·{" "}
                                  {card.employee.employeeId}
                                  {card.label && ` · ${card.label}`}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveNfc(card.uid)}
                              className="p-1.5 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── LOGS TAB ──────────────────────────────────────────────────────── */}
        {tab === "logs" && (
          <div>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
              <select
                value={logFilter.locationId}
                onChange={(e) =>
                  setLogFilter((p) => ({ ...p, locationId: e.target.value }))
                }
                className="border-2 border-black px-3 py-2 text-sm font-medium bg-white focus:outline-none"
              >
                <option value="">All Locations</option>
                {locations.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={logFilter.date}
                onChange={(e) =>
                  setLogFilter((p) => ({ ...p, date: e.target.value }))
                }
                className="border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none"
              />
              <button
                onClick={fetchLogs}
                className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-black text-sm uppercase nb-shadow-sm"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>

            {logsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#024BAB]" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 bg-white border-2 border-black">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="font-black text-gray-500">
                  No biometric activity found
                </p>
              </div>
            ) : (
              <div className="bg-white border-2 border-black overflow-hidden nb-shadow">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-black bg-[#024BAB] text-white">
                      <th className="text-left px-4 py-3 text-xs font-black uppercase">
                        Employee
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-black uppercase">
                        Location
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-black uppercase">
                        Device
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-black uppercase">
                        Method
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-black uppercase">
                        Type
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-black uppercase">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, i) => (
                      <tr
                        key={log._id}
                        className={cn(
                          "border-b border-gray-100",
                          i % 2 === 0 ? "bg-white" : "bg-gray-50/50",
                        )}
                      >
                        <td className="px-4 py-3">
                          <p className="font-black text-sm">
                            {log.employee.firstName} {log.employee.lastName}
                          </p>
                          <p className="text-xs text-gray-500 font-mono">
                            {log.employee.employeeId}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            {log.location.name}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-600">
                          {log.device.name}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "text-xs font-black uppercase px-2 py-0.5 border",
                              log.method === "nfc"
                                ? "bg-blue-50 text-blue-700 border-blue-300"
                                : log.method === "face"
                                  ? "bg-purple-50 text-purple-700 border-purple-300"
                                  : "bg-gray-50 text-gray-600 border-gray-300",
                            )}
                          >
                            {log.method === "nfc"
                              ? "NFC"
                              : log.method === "face"
                                ? "Face"
                                : "PIN"}
                          </span>
                          {log.nfcUid && (
                            <p className="text-xs font-mono text-gray-400 mt-0.5">
                              {log.nfcUid}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "text-xs font-black uppercase px-2 py-0.5 border flex items-center gap-1 w-fit",
                              log.type === "check_in"
                                ? "bg-green-50 text-green-700 border-green-300"
                                : "bg-orange-50 text-orange-700 border-orange-300",
                            )}
                          >
                            <Clock className="w-3 h-3" />
                            {log.type === "check_in" ? "Check In" : "Check Out"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-medium">
                          <p>{new Date(log.timestamp).toLocaleDateString()}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
