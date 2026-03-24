import PlayClient from './PlayClient';

export default async function PlayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PlayClient worldSlug={slug} />;
}
