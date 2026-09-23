import { LocalSeoPage } from "@/components/public/local-seo-page";
import { buildLocalSeoMetadata, localSeoPages } from "@/lib/local-seo-pages";

const page = localSeoPages["window-cleaning-san-jose"];

export const metadata = buildLocalSeoMetadata(page);

export default function WindowCleaningSanJosePage() {
  return <LocalSeoPage page={page} />;
}
