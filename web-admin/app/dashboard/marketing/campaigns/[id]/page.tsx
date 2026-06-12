import { CampaignDetailPage } from '@features/notifications/ui/campaign-detail-page'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CampaignDetailRoute({ params }: Props) {
  const { id } = await params
  return <CampaignDetailPage id={id} />
}
