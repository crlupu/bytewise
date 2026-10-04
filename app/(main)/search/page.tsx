import { SearchView } from "@/components/SearchView";
import { getCatalog } from "@/lib/content";

export default async function SearchPage() {
  return <SearchView catalog={await getCatalog()} />;
}
