import SidebarItem from "./SidebarItem";
import type { NavGroup } from "@/lib/config/navigation";

interface SidebarSectionProps {
  group: NavGroup;
  onItemClick?: () => void;
}

export default function SidebarSection({
  group,
  onItemClick,
}: SidebarSectionProps) {
  return (
    <div className="mb-4">
      <h3 className="px-3 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {group.label}
      </h3>
      <div className="space-y-0.5">
        {group.items.map((item) => (
          <SidebarItem key={item.href} item={item} onClick={onItemClick} />
        ))}
      </div>
    </div>
  );
}
