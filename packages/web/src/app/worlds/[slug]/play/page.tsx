import PlayClient from './PlayClient';

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ characterId?: string; targetZoneSlug?: string }>;
}) {
  const { slug } = await params;
  const { characterId, targetZoneSlug } = await searchParams;
  return <PlayClient worldSlug={slug} characterId={characterId ?? null} targetZoneSlug={targetZoneSlug ?? null} />;
}
