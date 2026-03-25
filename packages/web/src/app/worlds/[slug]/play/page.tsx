import PlayClient from './PlayClient';

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ characterId?: string }>;
}) {
  const { slug } = await params;
  const { characterId } = await searchParams;
  return <PlayClient worldSlug={slug} characterId={characterId ?? null} />;
}
