import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { Section } from "@/components/ui/card";
import { AcronymTable, type AcronymRow } from "@/components/acronyms/acronym-table";

/**
 * Glossaire du projet.
 *
 * Le POM en porte une trentaine, et toute la documentation les emploie sans
 * les developper : « le NOC de l'AFD sur le REoI », « ESMP du contractant ».
 * Qui arrive sur le projet devait ouvrir le POM pour les dechiffrer.
 *
 * Les sigles sont EDITABLES, y compris le sigle lui-meme : rien ne s'y
 * rattache, et c'est precisement ce qui vient d'arriver — MYS est devenu MSY.
 */
export default async function AcronymsPage() {
  const { t } = await getI18n();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("mg2030_acronym")
    .select("id, code, meaning")
    .order("code");

  if (error) throw new Error(`Lecture du glossaire : ${error.message}`);

  const acronyms: AcronymRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    code: r.code as string,
    meaning: r.meaning as string,
  }));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Section title={t("acronyms.title")} description={t("acronyms.intro")}>
        <AcronymTable acronyms={acronyms} />
      </Section>
    </div>
  );
}
