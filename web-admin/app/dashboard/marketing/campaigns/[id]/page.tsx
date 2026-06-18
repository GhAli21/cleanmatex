import { CampaignDetailPage } from '@features/notifications/ui/campaign-detail-page'

interface Props {
  params: Promise<{ id: string }>
}

/**
 *
 * @param root0
 * @param root0.params
 */
export default async function CampaignDetailRoute({ params }: Props) {
  const { id } = await params
  return <CampaignDetailPage id={id} />
}
