import { LibraryView } from "@/components/LibraryView";
import { getCatalog } from "@/lib/content";

export default async function LibraryPage() {
  return <LibraryView catalog={await getCatalog()} />;
}
