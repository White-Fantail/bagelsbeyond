"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const TRACKS_OPTIONS = [
  { value: "ALL", label: "Inventory Tracking All" },
  { value: "YES", label: "Inventory Tracking ON" },
  { value: "NO", label: "Inventory Tracking OFF" },
];

const ACTIVE_OPTIONS = [
  { value: "ALL", label: "All Status" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

type Props = { groups: { id: string; name: string }[] };

export default function ModifierFilters({ groups }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [groupId, setGroupId] = useState(searchParams.get("groupId") ?? "");
  const [tracks, setTracks] = useState(searchParams.get("tracksInventory") ?? "ALL");
  const [isActive, setIsActive] = useState(searchParams.get("isActive") ?? "ALL");

  const applyFilters = (overrides?: Record<string, string>) => {
    const params = new URLSearchParams();
    const s = overrides?.search ?? search;
    const g = overrides?.groupId ?? groupId;
    const t = overrides?.tracksInventory ?? tracks;
    const a = overrides?.isActive ?? isActive;
    if (s) params.set("search", s);
    if (g) params.set("groupId", g);
    if (t !== "ALL") params.set("tracksInventory", t);
    if (a !== "ALL") params.set("isActive", a);
    router.push("/admin/modifiers?" + params.toString());
  };

  const handleReset = () => {
    setSearch(""); setGroupId(""); setTracks("ALL"); setIsActive("ALL");
    router.push("/admin/modifiers");
  };

  const sel = "px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500";

  return (
    <form onSubmit={(e) => { e.preventDefault(); applyFilters(); }} className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <label className="text-xs font-medium text-gray-600">Name Search</label>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Modifier Name..." className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Group</label>
          <select value={groupId} onChange={(e) => { setGroupId(e.target.value); applyFilters({ groupId: e.target.value }); }} className={sel}>
            <option value="">All groups</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Inventory Tracking</label>
          <select value={tracks} onChange={(e) => { setTracks(e.target.value); applyFilters({ tracksInventory: e.target.value }); }} className={sel}>
            {TRACKS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Active</label>
          <select value={isActive} onChange={(e) => { setIsActive(e.target.value); applyFilters({ isActive: e.target.value }); }} className={sel}>
            {ACTIVE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600">Search</button>
          <button type="button" onClick={handleReset} className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50">Reset</button>
        </div>
      </div>
    </form>
  );
}
