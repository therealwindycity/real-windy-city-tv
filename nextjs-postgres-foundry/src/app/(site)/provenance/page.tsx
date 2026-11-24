import { getProvenanceBundle } from "@/lib/bundle";
import { ProvenanceFilmsWorkbench } from "@/components/GothamFoundrySuite";

export const dynamic = "force-dynamic";

export default async function ProvenancePage() {
  const catalog = await getProvenanceBundle();
  return (
    <div className="mx-auto max-w-7xl py-6">
      <ProvenanceFilmsWorkbench catalog={catalog} />
    </div>
  );
}
