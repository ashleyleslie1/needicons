import { useState } from "react";
import { MainTabs } from "@/components/layout/main-tabs";
import { GeneratePage } from "@/pages/generate";
import { ProjectPage } from "@/pages/project";
import type { MainTab } from "@/components/layout/main-tabs";

export function HomePage() {
  const [activeTab, setActiveTab] = useState<MainTab>("generate");

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-w-0">
      <MainTabs activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === "generate" ? <GeneratePage /> : <ProjectPage />}
    </div>
  );
}
