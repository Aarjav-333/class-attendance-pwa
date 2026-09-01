import { SessionDetailView } from './SessionDetailView';

export const metadata = {
  title: 'Attendance detail',
};

/**
 * Server component wrapper: unwraps the async route params (Next.js 15) and
 * hands the id to the client screen that loads and renders the session.
 */
export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SessionDetailView sessionId={id} />;
}
