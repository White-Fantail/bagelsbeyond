import SettingsForm from "@/components/SettingsForm";
import { prisma } from "@/lib/db";

async function getSettings() {
  try {
    let settings = await prisma.appSetting.findFirst();
    if (!settings) {
      settings = await prisma.appSetting.create({ data: {} });
    }
    return settings;
  } catch {
    return null;
  }
}

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="text-gray-500 mt-1">기본 설정을 관리합니다</p>
      </div>
      <SettingsForm
        initialData={
          settings ?? {
            shopName: "Bagels Beyond",
            defaultTargetWasteRatio: 0.05,
            defaultSafetyBuffer: 1.1,
          }
        }
      />
    </div>
  );
}
