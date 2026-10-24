import { HomeView } from "@/components/HomeView";
import { getCatalog } from "@/lib/content";

export default async function TodayPage() {
  return <HomeView catalog={await getCatalog()} />;
}
