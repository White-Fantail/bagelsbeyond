"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const SOURCE_OPTIONS = [
  { value: "ALL", label: "전체 출처" },
  { value: "LOYVERSE", label: "Loyverse Sync" },
  { value: "INTERNAL", label: "내부 생성" },
];

const TRACKS_OPTIONS = [
  { value: "ALL", label: "재고추적 전체" },
  { value: "YES", label: "재고추적 ON" },
  { value: "NO", label: "재고추적 OFF" },
];

const ACTIVE_OPTIONS = [
  { value: "ALL", label: "전체 상태" },
  { value: "ACTIVE", label: "활성" },
  { value: "INACTIVE", label: "비활성" },
];

type Props = { groups: { id: string; name: string }[] };

export default function ModifierFilters({ groups }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [groupId, setGroupId] = useState(searchParams.get("groupId") ?? "");
  const [source, setSource] = useState(searchParams.get("source") ?? "ALL");
  const [tracks, setTracks] = useState(searchParams.get("tracksInventory") ?? "ALL");
  const [isActive, setIsActive] = useState(searchParams.get("isActive") ?? "ALL");

  const applyFilters = (overrides?: Record<string, string>) => {
    const params = new URLSearchParams();
    const s = overrides?.search ?? search;
    const g = overrides?.groupId ?? groupId;
    const src = overrides?.source ?? source;
    const t = overrides?.tracksInventory ?? tracks;
    const a = overrides?.isActive ?? isActive;
    if (s) params.set("search", s);
    if (g) params.set("groupId", g);
    if (src !== "ALL") params.set("source", src);
    if (t !== "ALL") params.set("tracksInventory", t);
    if (a !== "ALL") params.set("isActive", a);
    router.push("/admin/modifiers?" + params.toString());
  };

  const handleReset = () => {
    setSearch(""); setGroupId(""); setSource("ALL"); setTracks("ALL"); setIsActive("ALL");
    router.push("/admin/modifiers");
  };

  const sel = "px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500";

  return (
    <form onSubmit={(e) => { e.preventDefault(); applyFilters(); }} className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <label className="text-xs font-medium text-gray-600">이름 검색</label>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Modifier 이름..." className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">그룹</label>
          <select value={groupId} onChange={(e) => { setGroupId(e.target.value); applyFilters({ groupId: e.target.value }); }} className={sel}>
            <option value="">전체 그룹</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">출처</label>
          <select value={source} onChange={(e) => { setSource(e.target.value); applyFilters({ source: e.target.value }); }} className={sel}>
            {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">재고추적</label>
          <select value={tracks} onChange={(e) => { setTracks(e.target.value); applyFilters({ tracksInventory: e.target.value }); }} className={sel}>
            {TRACKS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">활성</label>
          <select value={isActive} onChange={(e) => { setIsActive(e.target.value); applyFilters({ isActive: e.target.value }); }} className={sel}>
            {ACTIVE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600">검색</button>
          <button type="button" onClick={handleReset} className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50">초기화</button>
        </div>
      </div>
    </form>
  );
}
