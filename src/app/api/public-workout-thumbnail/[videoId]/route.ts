import { publicWorkoutThumbnail } from '../../../../lib/public-workout-thumbnail';

export async function GET(request: Request, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  return publicWorkoutThumbnail(videoId, request.url);
}
