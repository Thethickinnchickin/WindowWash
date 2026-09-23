import { LocalSeoPage } from "@/components/public/local-seo-page";
import { buildLocalSeoMetadata, localSeoPages } from "@/lib/local-seo-pages";

const page = localSeoPages["gutter-cleaning-san-jose"];

export const metadata = buildLocalSeoMetadata(page);

export default function GutterCleaningSanJosePage() {
  return <LocalSeoPage page={page} />;
}
