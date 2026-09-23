import { LocalSeoPage } from "@/components/public/local-seo-page";
import { buildLocalSeoMetadata, localSeoPages } from "@/lib/local-seo-pages";

const page = localSeoPages["window-cleaning-bay-area"];

export const metadata = buildLocalSeoMetadata(page);

export default function WindowCleaningBayAreaPage() {
  return <LocalSeoPage page={page} />;
}
